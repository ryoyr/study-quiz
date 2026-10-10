import assert from "node:assert/strict";
import test from "node:test";
import { buildBatchFactCheckPrompt } from "../src/services/batchFactCheckService.ts";
import { buildQuestionContext } from "../src/services/promptBuilder.ts";
import type { Question } from "../src/types/Question.ts";

const base: Question = {
  id: "Q-1",
  examScopeId: "lpic101",
  category: "Linux",
  text: "問題",
  choices: ["A", "B", "C"],
  answerIndex: 0,
  explanation: "解説",
  weight: 1,
  difficulty: 1,
};

test("AI質問コンテキストは複数選択の正解集合を欠落させない", () => {
  const context = buildQuestionContext({
    ...base,
    questionType: "multiple",
    answerIndices: [0, 2],
  });
  assert.match(context, /回答方式: 複数選択/);
  assert.match(context, /正答: 選択肢1: A \/ 選択肢3: C/);
});

test("AI質問コンテキストは入力問題の許容回答を表示する", () => {
  const context = buildQuestionContext({
    ...base,
    questionType: "text",
    choices: [],
    acceptedAnswers: ["LVM", "Logical Volume Manager"],
  });
  assert.match(context, /回答方式: 入力/);
  assert.match(context, /正答: LVM \/ Logical Volume Manager/);
  assert.doesNotMatch(context, /選択肢1/);
});

test("一括ファクトチェックは3方式を判別可能な回答定義で送る", () => {
  const prompt = buildBatchFactCheckPrompt([
    base,
    { ...base, id: "Q-2", questionType: "multiple", answerIndices: [0, 2] },
    {
      ...base,
      id: "Q-3",
      questionType: "text",
      choices: [],
      acceptedAnswers: ["LVM"],
    },
  ]);
  assert.match(prompt, /"questionType": "single"/);
  assert.match(prompt, /"correctChoiceNumbers": \[/);
  assert.match(prompt, /"matching": "normalized-exact"/);
  assert.doesNotMatch(prompt, /"answerIndex"/);
});
