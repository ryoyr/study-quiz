import test from "node:test";
import assert from "node:assert/strict";
import {
  answerDefinitionForExternalUse,
  answerDefinitionOf,
  formatCorrectAnswer,
  formatQuestionResponse,
  isQuestionResponseCorrect,
  normalizeTextAnswer,
  responseFromHistory,
  responseToHistoryFields,
  validateQuestionAnswer,
} from "../src/services/questionAnswerService.ts";
import type { Question } from "../src/types/Question.ts";

const base: Question = {
  id: "q",
  examScopeId: "e",
  category: "c",
  text: "t",
  choices: ["a", "b", "c"],
  answerIndex: 0,
  explanation: "",
  weight: 1,
  difficulty: 1,
};

test("旧形式は択一として互換判定", () => {
  assert.equal(isQuestionResponseCorrect(base, 0), true);
  assert.deepEqual(answerDefinitionOf(base), {
    kind: "single",
    correctIndex: 0,
  });
});

test("複数選択は順不同かつ完全一致", () => {
  const question = {
    ...base,
    questionType: "multiple" as const,
    answerIndices: [0, 2],
  };
  assert.equal(isQuestionResponseCorrect(question, [2, 0]), true);
  assert.equal(isQuestionResponseCorrect(question, [0]), false);
  assert.equal(formatCorrectAnswer(question), "選択肢1: a / 選択肢3: c");
});

test("入力回答はNFKC・空白・大小を正規化", () => {
  const question = {
    ...base,
    questionType: "text" as const,
    choices: [],
    acceptedAnswers: ["Linux Kernel"],
  };
  assert.equal(isQuestionResponseCorrect(question, "  LINUX   KERNEL "), true);
  assert.equal(normalizeTextAnswer("ＡＢＣ"), "abc");
  assert.equal(formatQuestionResponse(question, " lvm "), " lvm ");
});

test("入力問題の許容回答必須", () => {
  assert.deepEqual(
    validateQuestionAnswer({
      ...base,
      questionType: "text",
      choices: [],
      acceptedAnswers: [],
    }),
    ["入力問題には1件以上の許容回答が必要です。"],
  );
});

test("回答モデルは履歴互換フィールドと双方向変換する", () => {
  assert.deepEqual(responseToHistoryFields(1), { selectedIndex: 1 });
  assert.deepEqual(responseToHistoryFields([2, 0, 2]), {
    selectedIndex: -1,
    selectedIndices: [0, 2],
  });
  assert.deepEqual(responseToHistoryFields("LVM"), {
    selectedIndex: -1,
    textAnswer: "LVM",
  });
  assert.deepEqual(
    responseFromHistory({ selectedIndex: -1, selectedIndices: [0, 2] }),
    [0, 2],
  );
  assert.equal(
    responseFromHistory({ selectedIndex: -1, textAnswer: "LVM" }),
    "LVM",
  );
});

test("外部連携用回答定義は方式ごとに判別可能な形式を返す", () => {
  assert.deepEqual(answerDefinitionForExternalUse(base), {
    kind: "single",
    correctChoiceNumber: 1,
  });
  assert.deepEqual(
    answerDefinitionForExternalUse({
      ...base,
      questionType: "multiple",
      answerIndices: [0, 2],
    }),
    {
      kind: "multiple",
      correctChoiceNumbers: [1, 3],
      scoring: "exact",
    },
  );
  assert.equal(
    (answerDefinitionForExternalUse({
      ...base,
      questionType: "text",
      choices: [],
      acceptedAnswers: ["LVM"],
    }) as { kind: string }).kind,
    "text",
  );
});
