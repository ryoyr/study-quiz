import type { Question } from "../types/Question";
import {
  answerDefinitionOf,
  correctIndicesOf,
} from "./questionAnswerModel";

export {
  answerDefinitionForExternalUse,
  answerDefinitionOf,
  correctIndicesOf,
  createStudyHistoryQuestionSnapshot,
  formatCorrectAnswer,
  formatHistoryCorrectAnswer,
  formatHistoryQuestionResponse,
  formatQuestionResponse,
  historyQuestionText,
  isStudyHistoryQuestionSnapshot,
  isQuestionResponseCorrect,
  normalizeTextAnswer,
  questionTypeLabel,
  questionTypeOf,
  responseFromHistory,
  responseToHistoryFields,
} from "./questionAnswerModel";
export type {
  LegacyHistoryAnswerFields,
  QuestionAnswerDefinition,
  QuestionResponse,
  TextAnswerNormalization,
} from "./questionAnswerModel";

export const validateQuestionAnswer = (question: Question): string[] => {
  const answer = answerDefinitionOf(question);
  if (answer.kind === "text") {
    return answer.acceptedAnswers.some((value) => value.trim())
      ? []
      : ["入力問題には1件以上の許容回答が必要です。"];
  }

  const errors: string[] = [];
  if (question.choices.length < 2)
    errors.push("選択問題には2件以上の選択肢が必要です。");
  const indices = correctIndicesOf(question);
  if (
    indices.length === 0 ||
    indices.some(
      (index) =>
        !Number.isInteger(index) || index < 0 || index >= question.choices.length,
    )
  ) {
    errors.push("正解の選択肢指定が不正です。");
  }
  if (
    answer.kind === "multiple" &&
    new Set(question.answerIndices ?? []).size !==
      (question.answerIndices ?? []).length
  ) {
    errors.push("複数選択問題の正解に重複があります。");
  }
  return errors;
};
