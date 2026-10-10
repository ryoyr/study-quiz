import assert from "node:assert/strict";
import test from "node:test";
import {
  applyQuestionQualityProposal,
  reviewQuestionQualityProposal,
  saveQuestionQualityProposals,
} from "../src/services/questionQualityProposalStorage.ts";
import {
  buildQuestionQualityPrompt,
  createQuestionSeedUpdatePack,
  createQualityInput,
  parseQuestionQualityProposals,
} from "../src/services/questionQualityService.ts";
import type { Question } from "../src/types/Question.ts";
import type { QuestionQualityProposal } from "../src/types/QuestionQualityProposal.ts";
import {
  createFullBackup,
  parseFullBackup,
} from "../src/services/fullBackupService.ts";

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}
const installStorage = () => {
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
  return storage;
};

const question: Question = {
  id: "Q-1",
  examScopeId: "lpic101",
  category: "Linux",
  text: "元の問題文",
  choices: ["A", "B"],
  answerIndex: 0,
  explanation: "元の解説",
  source: "source",
  tags: ["tag"],
  weight: 1,
  difficulty: 1,
};
const proposalJson = (proposed: Record<string, unknown>, kind = "correction") =>
  JSON.stringify({
    format: "study-quiz-question-quality-proposals",
    version: 1,
    proposals: [{
      questionId: question.id,
      kind,
      summary: "品質改善",
      reason: "説明を明確にするため",
      reference: "official",
      proposed,
    }],
  });

test("品質確認は問題JSONと修正・補足提案の出力契約を生成する", () => {
  const input = createQualityInput([question]);
  assert.equal(input.format, "study-quiz-question-quality-input");
  assert.equal(input.questions[0].answer.kind, "single");
  const prompt = buildQuestionQualityPrompt([question]);
  assert.match(prompt, /correction/);
  assert.match(prompt, /supplement/);
  assert.match(prompt, /study-quiz-question-quality-proposals/);
  assert.match(prompt, /元の解説/);
});

test("JSON提案を現在問題へマージし、変更前後を保持する", () => {
  const [proposal] = parseQuestionQualityProposals(
    proposalJson({ explanation: "補足を加えた解説" }, "supplement"),
    [question],
  );
  assert.equal(proposal.kind, "supplement");
  assert.equal(proposal.beforeQuestion.explanation, "元の解説");
  assert.equal(proposal.proposedQuestion.explanation, "補足を加えた解説");
  assert.equal(proposal.status, "pending");
});

test("空の提案、重複問題、提案後に不正となる回答定義を拒否する", () => {
  assert.throws(
    () => parseQuestionQualityProposals(proposalJson({}), [question]),
    /proposedが空/,
  );
  assert.throws(
    () =>
      parseQuestionQualityProposals(
        proposalJson({ answerIndex: 9 }),
        [question],
      ),
    /提案後データが不正/,
  );
  const duplicate = JSON.parse(proposalJson({ explanation: "new" }));
  duplicate.proposals.push({ ...duplicate.proposals[0], proposed: { text: "new" } });
  assert.throws(
    () => parseQuestionQualityProposals(JSON.stringify(duplicate), [question]),
    /重複/,
  );
});

test("レビュー済み提案を問題と提案履歴へ同一トランザクションで適用する", () => {
  const storage = installStorage();
  const [proposal] = parseQuestionQualityProposals(
    proposalJson({ text: "改善後の問題文", explanation: "改善後の解説" }),
    [question],
  );
  const result = applyQuestionQualityProposal([question], [proposal], proposal.id);
  assert.equal(result.questions[0].text, "改善後の問題文");
  assert.equal(result.proposals[0].status, "applied");
  assert.ok(result.proposals[0].appliedAt);
  assert.equal(
    JSON.parse(storage.getItem("study-quiz-questions-v1") ?? "[]")[0].explanation,
    "改善後の解説",
  );
  assert.equal(
    JSON.parse(storage.getItem("study-quiz-question-quality-proposals-v1") ?? "[]")[0].status,
    "applied",
  );
  assert.equal(storage.getItem("study-quiz-schema-version"), null);
});

test("提案作成後に現在問題が変わった場合は上書きしない", () => {
  installStorage();
  const [proposal] = parseQuestionQualityProposals(
    proposalJson({ explanation: "改善後の解説" }),
    [question],
  );
  assert.throws(
    () =>
      applyQuestionQualityProposal(
        [{ ...question, text: "別の編集" }],
        [proposal],
        proposal.id,
      ),
    /提案作成後に問題が変更/,
  );
});

test("却下状態と適用済み初期データ更新パックを生成する", () => {
  installStorage();
  const [pending] = parseQuestionQualityProposals(
    proposalJson({ explanation: "改善後の解説" }),
    [question],
  );
  const rejected = reviewQuestionQualityProposal([pending], pending.id, "rejected");
  assert.equal(rejected[0].status, "rejected");
  const appliedAt = "2026-10-11T00:00:00.000Z";
  const applied: QuestionQualityProposal = {
    ...pending,
    status: "applied",
    reviewedAt: appliedAt,
    appliedAt,
    updatedAt: appliedAt,
  };
  saveQuestionQualityProposals([applied]);
  const pack = createQuestionSeedUpdatePack([applied, ...rejected]);
  assert.equal(pack.format, "study-quiz-question-seed-updates");
  assert.equal(pack.updates.length, 1);
  assert.equal(pack.updates[0].beforeQuestion.explanation, "元の解説");
  assert.equal(pack.updates[0].question.explanation, "改善後の解説");
});

test("品質提案を完全バックアップversion 10で往復する", () => {
  const storage = installStorage();
  const [proposal] = parseQuestionQualityProposals(
    proposalJson({ explanation: "改善後の解説" }),
    [question],
  );
  storage.setItem("study-quiz-schema-version", "9");
  storage.setItem("study-quiz-questions-v1", JSON.stringify([question]));
  storage.setItem(
    "study-quiz-question-quality-proposals-v1",
    JSON.stringify([proposal]),
  );

  const backup = createFullBackup(storage);
  const parsed = parseFullBackup(JSON.stringify(backup));
  assert.equal(parsed.version, 10);
  assert.equal(parsed.sourceVersion, 10);
  assert.deepEqual(
    JSON.parse(parsed.entries["study-quiz-question-quality-proposals-v1"]),
    [proposal],
  );
});
