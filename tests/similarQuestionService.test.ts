import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSimilarQuestionPrompt,
  parseSimilarQuestionDraft,
  validateSimilarQuestion,
} from "../src/services/similarQuestionService.ts";
import type { Question } from "../src/types/Question.ts";

const baseQuestion: Question = {
  id: "Q-1",
  examScopeId: "lpic101",
  category: "Linux",
  subcategory: "権限",
  text: "chmod 755の説明として正しいものはどれか。",
  choices: ["所有者だけ実行可能", "全員が書込可能", "所有者は全権限"],
  answerIndex: 2,
  explanation: "7はrwxを表します。",
  source: "公式マニュアル",
  tags: ["基本"],
  weight: 3,
  difficulty: 2,
};

const validJson = JSON.stringify({
  category: "Linux",
  subcategory: "権限",
  text: "chmod 640でグループに与えられる権限はどれか。",
  choices: ["なし", "読取のみ", "読取と書込"],
  answerNumber: 2,
  explanation: "640の第2桁4は読取権限です。",
  source: "公式マニュアル",
  tags: ["基本", "類似問題"],
  weight: 3,
  difficulty: 2,
});

test("元問題の文脈とJSON出力契約を含むプロンプトを生成する", () => {
  const prompt = buildSimilarQuestionPrompt(baseQuestion);
  assert.match(prompt, /元問題ID: Q-1/);
  assert.match(prompt, /answerNumberは1始まり/);
  assert.match(prompt, /選択肢3（正解）/);
});

test("AI回答JSONを検証し、一意な問題IDを採番する", () => {
  const draft = parseSimilarQuestionDraft(validJson, baseQuestion, [
    baseQuestion,
    { ...baseQuestion, id: "Q-1-SIM-01", text: "既存案" },
  ]);
  assert.equal(draft.id, "Q-1-SIM-02");
  assert.equal(draft.answerIndex, 1);
  assert.deepEqual(draft.tags, ["基本", "類似問題"]);
});

test("Markdownコードフェンス付きJSONも読み取る", () => {
  const draft = parseSimilarQuestionDraft(
    `\`\`\`json\n${validJson}\n\`\`\``,
    baseQuestion,
    [baseQuestion],
  );
  assert.equal(draft.id, "Q-1-SIM-01");
});

test("元問題と同一の問題文、重複選択肢、重複IDを拒否する", () => {
  const candidate = parseSimilarQuestionDraft(validJson, baseQuestion, [
    baseQuestion,
  ]);
  assert.throws(
    () =>
      validateSimilarQuestion(
        { ...candidate, text: baseQuestion.text },
        baseQuestion,
        [baseQuestion],
      ),
    /元問題と同一/,
  );
  assert.throws(
    () =>
      validateSimilarQuestion(
        { ...candidate, choices: ["同じ", "同じ"], answerIndex: 0 },
        baseQuestion,
        [baseQuestion],
      ),
    /同一内容の選択肢/,
  );
  assert.throws(
    () => validateSimilarQuestion(candidate, baseQuestion, [candidate]),
    /既に使用/,
  );
});

test("選択肢範囲外のanswerNumberを拒否する", () => {
  const invalid = JSON.stringify({
    ...JSON.parse(validJson),
    answerNumber: 9,
  });
  assert.throws(
    () => parseSimilarQuestionDraft(invalid, baseQuestion, [baseQuestion]),
    /answerNumberは1～3/,
  );
});

