import assert from "node:assert/strict";
import test from "node:test";
import {
  buildQuestionQualityPrompt,
  buildQuestionQualityRegenerationPrompt,
  createQuestionQualityBatches,
  parseQuestionQualityProposals,
  planQuestionQualitySelection,
} from "../src/services/questionQualityService.ts";
import type { Question } from "../src/types/Question.ts";

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
const proposalJson = (proposed: Record<string, unknown>) =>
  JSON.stringify({
    format: "study-quiz-question-quality-proposals",
    version: 1,
    proposals: [
      {
        questionId: question.id,
        kind: "correction",
        summary: "品質改善",
        reason: "説明を明確にするため",
        reference: "official",
        proposed,
      },
    ],
  });

test("品質対象は条件・未確認除外・元順序・ページ範囲を明示して選択する", () => {
  const items: Question[] = [
    question,
    {
      ...question,
      id: "Q-2",
      difficulty: 2,
      questionType: "multiple",
      choices: ["A", "B", "C"],
      answerIndices: [0, 2],
      source: undefined,
    },
    {
      ...question,
      id: "Q-3",
      category: "Network",
      difficulty: 3,
      questionType: "text",
      choices: [],
      answerIndex: -1,
      acceptedAnswers: ["answer"],
    },
    { ...question, id: "Q-4", archivedAt: "2026-10-11T00:00:00.000Z" },
  ];
  const plan = planQuestionQualitySelection(
    items,
    {
      categories: ["Linux"],
      difficulties: [1, 2],
      questionTypes: ["single", "multiple"],
      sourceFilter: "all",
      searchText: "",
      excludePending: true,
      offset: 0,
      limit: 1,
    },
    new Set(["Q-1"]),
  );
  assert.equal(plan.activeCount, 3);
  assert.equal(plan.filterMatchedCount, 2);
  assert.equal(plan.pendingExcludedCount, 1);
  assert.deepEqual(plan.matchedQuestions.map((item) => item.id), ["Q-2"]);
  assert.deepEqual(plan.pageQuestions.map((item) => item.id), ["Q-2"]);
  assert.equal(plan.pageStart, 0);
  assert.equal(plan.pageEnd, 1);
});

test("品質対象は検索・出典・回答方式を組み合わせ、ページ送りできる", () => {
  const items: Question[] = Array.from({ length: 4 }, (_, index) => ({
    ...question,
    id: `Q-${index + 1}`,
    text: `systemd 問題 ${index + 1}`,
    difficulty: 2,
  }));
  const plan = planQuestionQualitySelection(items, {
    categories: ["Linux"],
    difficulties: [2],
    questionTypes: ["single"],
    sourceFilter: "present",
    searchText: "SYSTEMD",
    excludePending: false,
    offset: 2,
    limit: 2,
  });
  assert.deepEqual(plan.pageQuestions.map((item) => item.id), ["Q-3", "Q-4"]);
  assert.equal(plan.hasPreviousPage, true);
  assert.equal(plan.hasNextPage, false);
});

test("品質維持の分割は元の選択順を保って最大件数で区切る", () => {
  const items = Array.from({ length: 18 }, (_, index) => ({
    ...question,
    id: `Q-${String(index + 1).padStart(2, "0")}`,
  }));
  const batches = createQuestionQualityBatches(items, 8);
  assert.deepEqual(batches.map((item) => item.questions.length), [8, 8, 2]);
  assert.equal(batches[0].questions[0].id, "Q-01");
  assert.equal(batches[2].questions[1].id, "Q-18");
});

test("品質重視プロンプトは誤答・解説・根拠・重複・難易度と分割情報を含む", () => {
  const prompt = buildQuestionQualityPrompt([question], {
    focus: "distractors",
    batchNumber: 2,
    batchCount: 4,
    comparisonQuestions: [
      question,
      { ...question, id: "Q-2", text: "比較問題" },
    ],
  });
  assert.match(prompt, /全4分割中の2番目/);
  assert.match(prompt, /誤答選択肢/);
  assert.match(prompt, /各誤答が誤りである理由/);
  assert.match(prompt, /一次情報/);
  assert.match(prompt, /難易度/);
  assert.match(prompt, /重複回避/);
  assert.match(prompt, /Q-2\tLinux/);
  assert.match(prompt, /出力前セルフチェック/);
});

test("再生成プロンプトは現在問題と前回案の弱点を引き継ぎJSON契約を維持する", () => {
  const [proposal] = parseQuestionQualityProposals(
    proposalJson({ explanation: "前回案の解説" }),
    [question],
  );
  const prompt = buildQuestionQualityRegenerationPrompt(question, proposal);
  assert.match(prompt, /前回提案は採用せず再検討/);
  assert.match(prompt, /品質改善/);
  assert.match(prompt, /前回案の解説/);
  assert.match(prompt, /study-quiz-question-quality-proposals/);
  assert.match(prompt, /現在の問題を基準/);
});
