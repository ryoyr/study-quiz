import test from "node:test";
import assert from "node:assert/strict";
import {
  answerDefinitionForExternalUse,
  answerDefinitionOf,
  formatCorrectAnswer,
  createStudyHistoryQuestionSnapshot,
  formatHistoryCorrectAnswer,
  formatHistoryQuestionResponse,
  historyQuestionText,
  isStudyHistoryQuestionSnapshot,
  formatQuestionResponse,
  isQuestionResponseCorrect,
  normalizeTextAnswer,
  responseFromHistory,
  responseToHistoryFields,
  validateQuestionAnswer,
} from "../src/services/questionAnswerService.ts";
import type { Question } from "../src/types/Question.ts";
import type { StudyHistory } from "../src/types/StudyHistory.ts";

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

test("回答時点スナップショットは後日の問題編集から履歴表示を独立させる", () => {
  const answeredQuestion: Question = {
    ...base,
    text: "回答時点の問題",
    questionType: "multiple",
    choices: ["旧A", "旧B", "旧C"],
    answerIndices: [0, 2],
  };
  const snapshot = createStudyHistoryQuestionSnapshot(answeredQuestion, [2, 0]);
  const history: StudyHistory = {
    id: "H-1",
    questionId: answeredQuestion.id,
    category: answeredQuestion.category,
    selectedIndex: -1,
    selectedIndices: [0, 2],
    answerType: "multiple",
    questionSnapshot: snapshot,
    correct: true,
    answeredAt: "2026-10-11T00:00:00.000Z",
    responseTimeSeconds: 5,
    instantScore: 0.8,
  };
  const editedQuestion: Question = {
    ...answeredQuestion,
    text: "編集後の問題",
    choices: ["新A", "新B", "新C"],
  };

  assert.equal(isStudyHistoryQuestionSnapshot(snapshot), true);
  assert.equal(historyQuestionText(history, editedQuestion), "回答時点の問題");
  assert.equal(
    formatHistoryQuestionResponse(history, editedQuestion),
    "選択肢1: 旧A / 選択肢3: 旧C",
  );
  assert.equal(
    formatHistoryCorrectAnswer(history, editedQuestion),
    "選択肢1: 旧A / 選択肢3: 旧C",
  );
});

test("旧履歴は現行問題を使うフォールバック表示を維持する", () => {
  const history: StudyHistory = {
    id: "H-old",
    questionId: base.id,
    category: base.category,
    selectedIndex: 1,
    correct: false,
    answeredAt: "2026-10-10T00:00:00.000Z",
    responseTimeSeconds: 5,
    instantScore: 0.5,
  };
  assert.equal(historyQuestionText(history, base), base.text);
  assert.equal(formatHistoryQuestionResponse(history, base), "選択肢2: b");
  assert.equal(formatHistoryCorrectAnswer(history, base), "選択肢1: a");
});
