import type { Question, QuestionType } from "../types/Question";
import type { StudyHistory } from "../types/StudyHistory";

export type QuestionResponse = number | number[] | string;

export type QuestionAnswerDefinition =
  | {
      kind: "single";
      correctIndex: number;
    }
  | {
      kind: "multiple";
      correctIndices: number[];
      scoring: "exact";
    }
  | {
      kind: "text";
      acceptedAnswers: string[];
      matching: "normalized-exact";
      normalization: TextAnswerNormalization;
    };

export interface TextAnswerNormalization {
  unicode: "NFKC";
  trim: true;
  collapseWhitespace: true;
  caseSensitive: false;
}

export interface LegacyHistoryAnswerFields {
  selectedIndex: number;
  selectedIndices?: number[];
  textAnswer?: string;
}

export const DEFAULT_TEXT_NORMALIZATION: TextAnswerNormalization = {
  unicode: "NFKC",
  trim: true,
  collapseWhitespace: true,
  caseSensitive: false,
};

export const questionTypeOf = (question: Question): QuestionType =>
  question.questionType ?? "single";

const uniqueSortedIndices = (values: number[]): number[] =>
  [...new Set(values)].sort((left, right) => left - right);

/**
 * 永続化形式の互換フィールドを、回答方式ごとの判別可能な内部モデルへ変換する。
 * 新しい採点方式を追加するときは、この境界以降を拡張し、保存形式の移行を局所化する。
 */
export const answerDefinitionOf = (
  question: Question,
): QuestionAnswerDefinition => {
  const kind = questionTypeOf(question);
  if (kind === "multiple") {
    return {
      kind,
      correctIndices: uniqueSortedIndices(
        question.answerIndices ?? [question.answerIndex],
      ),
      scoring: "exact",
    };
  }
  if (kind === "text") {
    return {
      kind,
      acceptedAnswers: [...new Set(question.acceptedAnswers ?? [])],
      matching: "normalized-exact",
      normalization: DEFAULT_TEXT_NORMALIZATION,
    };
  }
  return { kind, correctIndex: question.answerIndex };
};

export const normalizeTextAnswer = (value: string): string =>
  value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase();

export const correctIndicesOf = (question: Question): number[] => {
  const answer = answerDefinitionOf(question);
  if (answer.kind === "single") return [answer.correctIndex];
  if (answer.kind === "multiple") return answer.correctIndices;
  return [];
};

export const isQuestionResponseCorrect = (
  question: Question,
  response: QuestionResponse,
): boolean => {
  const answer = answerDefinitionOf(question);
  if (answer.kind === "text") {
    return (
      typeof response === "string" &&
      answer.acceptedAnswers.some(
        (accepted) => normalizeTextAnswer(accepted) === normalizeTextAnswer(response),
      )
    );
  }
  if (answer.kind === "multiple") {
    if (!Array.isArray(response)) return false;
    const actual = uniqueSortedIndices(response);
    return (
      actual.length === answer.correctIndices.length &&
      actual.every((value, index) => value === answer.correctIndices[index])
    );
  }
  return typeof response === "number" && response === answer.correctIndex;
};

const choiceLabel = (question: Question, index: number): string => {
  const choice = question.choices[index];
  return choice === undefined
    ? `選択肢${index + 1}`
    : `選択肢${index + 1}: ${choice}`;
};

export const questionTypeLabel = (question: Question): string => {
  const type = questionTypeOf(question);
  if (type === "multiple") return "複数選択";
  if (type === "text") return "入力";
  return "択一";
};

export const formatCorrectAnswer = (question: Question): string => {
  const answer = answerDefinitionOf(question);
  if (answer.kind === "text") {
    return answer.acceptedAnswers.length > 0
      ? answer.acceptedAnswers.join(" / ")
      : "正答例未設定";
  }
  const indices =
    answer.kind === "multiple" ? answer.correctIndices : [answer.correctIndex];
  return indices.map((index) => choiceLabel(question, index)).join(" / ");
};

export const formatQuestionResponse = (
  question: Question,
  response: QuestionResponse | null,
): string => {
  if (response === null) return "未回答";
  if (typeof response === "string") return response || "（空欄）";
  if (Array.isArray(response)) {
    return response.length > 0
      ? uniqueSortedIndices(response)
          .map((index) => choiceLabel(question, index))
          .join(" / ")
      : "未選択";
  }
  return choiceLabel(question, response);
};

export const responseToHistoryFields = (
  response: QuestionResponse,
): LegacyHistoryAnswerFields => {
  if (typeof response === "string") {
    return { selectedIndex: -1, textAnswer: response };
  }
  if (Array.isArray(response)) {
    return {
      selectedIndex: -1,
      selectedIndices: uniqueSortedIndices(response),
    };
  }
  return { selectedIndex: response };
};

export const responseFromHistory = (
  history: Pick<StudyHistory, "selectedIndex" | "selectedIndices" | "textAnswer">,
): QuestionResponse | null => {
  if (typeof history.textAnswer === "string") return history.textAnswer;
  if (Array.isArray(history.selectedIndices)) return history.selectedIndices;
  return history.selectedIndex >= 0 ? history.selectedIndex : null;
};

export const answerDefinitionForExternalUse = (
  question: Question,
): Record<string, unknown> => {
  const answer = answerDefinitionOf(question);
  if (answer.kind === "single") {
    return { kind: answer.kind, correctChoiceNumber: answer.correctIndex + 1 };
  }
  if (answer.kind === "multiple") {
    return {
      kind: answer.kind,
      correctChoiceNumbers: answer.correctIndices.map((index) => index + 1),
      scoring: answer.scoring,
    };
  }
  return {
    kind: answer.kind,
    acceptedAnswers: answer.acceptedAnswers,
    matching: answer.matching,
    normalization: answer.normalization,
  };
};
