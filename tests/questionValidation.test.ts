import assert from "node:assert/strict";
import test from "node:test";
import {
  isQuestion,
  questionValidationErrors,
} from "../src/services/questionValidation.ts";
import type { Question } from "../src/types/Question.ts";

const base: Question = {
  id: "Q-1",
  examScopeId: "lpic101",
  category: "Linux",
  text: "問題",
  questionType: "single",
  choices: ["A", "B"],
  answerIndex: 0,
  explanation: "解説",
  tags: ["LPIC-1"],
  weight: 1,
  difficulty: 1,
};

test("共通問題検証は旧択一・複数選択・入力回答を受け付ける", () => {
  const legacy = { ...base, questionType: undefined };
  const multiple = {
    ...base,
    questionType: "multiple" as const,
    choices: ["A", "B", "C"],
    answerIndices: [0, 2],
  };
  const text = {
    ...base,
    questionType: "text" as const,
    choices: [],
    acceptedAnswers: ["LVM"],
  };
  assert.equal(isQuestion(legacy), true);
  assert.equal(isQuestion(multiple), true);
  assert.equal(isQuestion(text), true);
});

test("共通問題検証は長さ・タグ件数・回答方式固有制約を一括検証する", () => {
  assert.match(
    questionValidationErrors({ ...base, category: "x".repeat(501) }).join(" "),
    /500文字/,
  );
  assert.match(
    questionValidationErrors({ ...base, tags: Array.from({ length: 31 }, (_, index) => `t${index}`) }).join(" "),
    /30件/,
  );
  assert.match(
    questionValidationErrors({ ...base, questionType: "multiple", answerIndices: [0, 0] }).join(" "),
    /重複/,
  );
  assert.match(
    questionValidationErrors({ ...base, questionType: "text", choices: [], acceptedAnswers: [] }).join(" "),
    /許容回答/,
  );
  assert.match(
    questionValidationErrors({ ...base, choices: ["同じ", "同じ"] }).join(" "),
    /重複/,
  );
});
