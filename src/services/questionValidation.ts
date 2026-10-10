import type { Question, QuestionType } from "../types/Question";

export const QUESTION_LIMITS = {
  id: 200,
  examScopeId: 200,
  shortText: 500,
  longText: 20_000,
  maxChoices: 8,
  maxTags: 30,
  maxAcceptedAnswers: 100,
} as const;

const QUESTION_TYPES = new Set<QuestionType>(["single", "multiple", "text"]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown, maxLength: number): value is string =>
  typeof value === "string" &&
  value.trim().length > 0 &&
  value.length <= maxLength;

const isOptionalString = (value: unknown, maxLength: number): boolean =>
  value === undefined || (typeof value === "string" && value.length <= maxLength);

const validateChoices = (value: unknown, minimum: number): string[] => {
  if (!Array.isArray(value) || value.length < minimum || value.length > QUESTION_LIMITS.maxChoices) {
    return [
      minimum === 0
        ? `選択肢は${QUESTION_LIMITS.maxChoices}件以下で指定してください。`
        : `選択問題には${minimum}～${QUESTION_LIMITS.maxChoices}件の選択肢が必要です。`,
    ];
  }
  if (!value.every((choice) => isNonEmptyString(choice, QUESTION_LIMITS.longText))) {
    return [
      `選択肢は空欄にせず、各${QUESTION_LIMITS.longText.toLocaleString()}文字以内で指定してください。`,
    ];
  }
  if (new Set(value).size !== value.length) {
    return ["同一内容の選択肢は重複して指定できません。"];
  }
  return [];
};

/**
 * 保存、バックアップ、画面編集で共有するQuestionの整合性検証。
 * 旧データでquestionTypeが省略されている場合はsingleとして扱う。
 */
export const questionValidationErrors = (value: unknown): string[] => {
  if (!isRecord(value)) return ["問題データがオブジェクトではありません。"];

  const errors: string[] = [];
  const questionType = (value.questionType ?? "single") as QuestionType;

  if (!isNonEmptyString(value.id, QUESTION_LIMITS.id))
    errors.push(`問題IDは必須で、${QUESTION_LIMITS.id}文字以内です。`);
  if (!isNonEmptyString(value.examScopeId, QUESTION_LIMITS.examScopeId))
    errors.push(`試験枠IDは必須で、${QUESTION_LIMITS.examScopeId}文字以内です。`);
  if (!isNonEmptyString(value.category, QUESTION_LIMITS.shortText))
    errors.push(`カテゴリは必須で、${QUESTION_LIMITS.shortText}文字以内です。`);
  if (!isOptionalString(value.subcategory, QUESTION_LIMITS.shortText))
    errors.push(`サブカテゴリは${QUESTION_LIMITS.shortText}文字以内です。`);
  if (!isNonEmptyString(value.text, QUESTION_LIMITS.longText))
    errors.push(`問題文は必須で、${QUESTION_LIMITS.longText.toLocaleString()}文字以内です。`);
  if (!QUESTION_TYPES.has(questionType)) errors.push("回答方式が不正です。");

  if (QUESTION_TYPES.has(questionType)) {
    if (questionType === "text") {
      errors.push(...validateChoices(value.choices, 0));
      if (
        !Array.isArray(value.acceptedAnswers) ||
        value.acceptedAnswers.length === 0 ||
        value.acceptedAnswers.length > QUESTION_LIMITS.maxAcceptedAnswers ||
        !value.acceptedAnswers.every((answer) =>
          isNonEmptyString(answer, QUESTION_LIMITS.longText),
        )
      ) {
        errors.push(
          `入力問題には1～${QUESTION_LIMITS.maxAcceptedAnswers}件の許容回答が必要です（各${QUESTION_LIMITS.longText.toLocaleString()}文字以内）。`,
        );
      }
    } else {
      const choices = Array.isArray(value.choices) ? value.choices : [];
      errors.push(...validateChoices(value.choices, 2));
      if (
        !Number.isInteger(value.answerIndex) ||
        Number(value.answerIndex) < 0 ||
        Number(value.answerIndex) >= choices.length
      ) {
        errors.push("正解の選択肢指定が不正です。");
      }
      if (questionType === "multiple") {
        if (
          !Array.isArray(value.answerIndices) ||
          value.answerIndices.length === 0 ||
          new Set(value.answerIndices).size !== value.answerIndices.length ||
          !value.answerIndices.every(
            (index) =>
              Number.isInteger(index) &&
              Number(index) >= 0 &&
              Number(index) < choices.length,
          )
        ) {
          errors.push("複数選択問題の正解は、重複のない選択肢番号で1件以上指定してください。");
        }
      }
    }
  }

  if (typeof value.explanation !== "string" || value.explanation.length > QUESTION_LIMITS.longText)
    errors.push(`解説は${QUESTION_LIMITS.longText.toLocaleString()}文字以内です。`);
  if (!isOptionalString(value.source, QUESTION_LIMITS.longText))
    errors.push(`出典は${QUESTION_LIMITS.longText.toLocaleString()}文字以内です。`);
  if (
    value.tags !== undefined &&
    (!Array.isArray(value.tags) ||
      value.tags.length > QUESTION_LIMITS.maxTags ||
      !value.tags.every((tag) => isNonEmptyString(tag, QUESTION_LIMITS.shortText)))
  ) {
    errors.push(
      `タグは${QUESTION_LIMITS.maxTags}件以下、各${QUESTION_LIMITS.shortText}文字以内です。`,
    );
  }
  if (typeof value.weight !== "number" || !Number.isFinite(value.weight) || value.weight <= 0)
    errors.push("出題ウェイトは0より大きい数値です。");
  if (
    !Number.isInteger(value.difficulty) ||
    Number(value.difficulty) < 1 ||
    Number(value.difficulty) > 5
  )
    errors.push("難易度は1～5の整数です。");
  if (
    value.archivedAt !== undefined &&
    (typeof value.archivedAt !== "string" || !Number.isFinite(Date.parse(value.archivedAt)))
  )
    errors.push("アーカイブ日時が不正です。");

  return errors;
};

export const isQuestion = (value: unknown): value is Question =>
  questionValidationErrors(value).length === 0;
