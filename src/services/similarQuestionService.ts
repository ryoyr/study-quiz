import type { Question, QuestionType } from "../types/Question";
import { buildQuestionContext } from "./promptBuilder";
import {
  questionTypeLabel,
  questionTypeOf,
} from "./questionAnswerModel";
import {
  QUESTION_LIMITS,
  questionValidationErrors,
} from "./questionValidation";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const requiredText = (
  value: unknown,
  label: string,
  maxLength: number = QUESTION_LIMITS.longText,
): string => {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label}を入力してください。`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new Error(`${label}は${maxLength}文字以下にしてください。`);
  }
  return normalized;
};

const optionalText = (
  value: unknown,
  label: string,
  maxLength: number = QUESTION_LIMITS.longText,
): string | undefined => {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new Error(`${label}の形式が不正です。`);
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new Error(`${label}は${maxLength}文字以下にしてください。`);
  }
  return normalized || undefined;
};

const numberInRange = (
  value: unknown,
  label: string,
  minimum: number,
  maximum: number,
): number => {
  const numberValue = Number(value);
  if (
    !Number.isInteger(numberValue) ||
    numberValue < minimum ||
    numberValue > maximum
  ) {
    throw new Error(`${label}は${minimum}～${maximum}の整数にしてください。`);
  }
  return numberValue;
};

const stripCodeFence = (value: string): string => {
  const trimmed = value.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/iu);
  return match?.[1]?.trim() ?? trimmed;
};

const createUniqueId = (baseId: string, existingQuestions: Question[]): string => {
  const used = new Set(existingQuestions.map((item) => item.id));
  for (let sequence = 1; sequence <= 9999; sequence += 1) {
    const candidate = `${baseId}-SIM-${String(sequence).padStart(2, "0")}`;
    if (!used.has(candidate)) return candidate;
  }
  throw new Error("類似問題IDを採番できませんでした。");
};

const parseQuestionType = (
  value: unknown,
  fallback: QuestionType,
): QuestionType => {
  if (value === undefined || value === "") return fallback;
  if (value === "single" || value === "multiple" || value === "text") return value;
  throw new Error("questionTypeはsingle、multiple、textのいずれかです。");
};

const jsonContractFor = (type: QuestionType): string => {
  const common =
    '"category":"","subcategory":"","text":"","explanation":"","source":"","tags":[],"weight":1,"difficulty":1';
  if (type === "multiple") {
    return `{"questionType":"multiple",${common},"choices":["","",""],"answerNumbers":[1,3]}`;
  }
  if (type === "text") {
    return `{"questionType":"text",${common},"acceptedAnswers":[""]}`;
  }
  return `{"questionType":"single",${common},"choices":["",""],"answerNumber":1}`;
};

export const buildSimilarQuestionPrompt = (baseQuestion: Question): string => {
  const type = questionTypeOf(baseQuestion);
  const answerInstruction =
    type === "multiple"
      ? "answerNumbersは1始まりの整数配列です。choicesは2～8件、正解は重複なく1件以上にしてください。"
      : type === "text"
        ? "acceptedAnswersは正答として許容する文字列配列です。表記揺れが必要な場合は複数指定してください。"
        : "answerNumberは1始まりです。choicesは2～8件にしてください。";
  return [
    "次の資格試験問題を基に、同じ知識を別の角度から確認する類似問題案を1件作成してください。",
    "元問題の単なる言い換えや正解位置だけの変更は避けてください。根拠が不明な内容は作らないでください。",
    `回答方式は元問題と同じ${questionTypeLabel(baseQuestion)}（${type}）を維持してください。`,
    "出力はMarkdownや説明文を付けず、次のキーを持つJSONオブジェクトだけにしてください。",
    jsonContractFor(type),
    `${answerInstruction} weightとdifficultyは1～5の整数にしてください。`,
    "",
    `元問題ID: ${baseQuestion.id}`,
    buildQuestionContext(baseQuestion),
  ].join("\n");
};

export const validateSimilarQuestion = (
  candidate: Question,
  baseQuestion: Question,
  existingQuestions: Question[],
): Question => {
  const id = requiredText(candidate.id, "問題ID", QUESTION_LIMITS.id);
  if (existingQuestions.some((item) => item.id === id)) {
    throw new Error(`問題ID ${id} は既に使用されています。`);
  }

  const type = questionTypeOf(candidate);
  const text = requiredText(candidate.text, "問題文");
  if (text === baseQuestion.text.trim()) {
    throw new Error("元問題と同一の問題文は登録できません。");
  }

  const choices = type === "text"
    ? []
    : candidate.choices.map((choice, index) =>
        requiredText(choice, `選択肢${index + 1}`),
      );
  if (new Set(choices).size !== choices.length) {
    throw new Error("同一内容の選択肢は登録できません。");
  }

  const rawAnswerIndices = candidate.answerIndices ?? [];
  if (type === "multiple" && new Set(rawAnswerIndices).size !== rawAnswerIndices.length) {
    throw new Error("複数選択問題の正解に重複があります。");
  }
  const answerIndices = type === "multiple"
    ? [...rawAnswerIndices].sort((left, right) => left - right)
    : undefined;
  const acceptedAnswers = type === "text"
    ? [...new Set((candidate.acceptedAnswers ?? []).map((answer) => answer.trim()).filter(Boolean))]
    : undefined;
  const answerIndex = type === "multiple"
    ? (answerIndices?.[0] ?? 0)
    : type === "single"
      ? candidate.answerIndex
      : 0;
  const tags = [...new Set((candidate.tags ?? []).map((tag) => tag.trim()).filter(Boolean))];
  const subcategory = optionalText(
    candidate.subcategory,
    "サブカテゴリ",
    QUESTION_LIMITS.shortText,
  );
  const source = optionalText(candidate.source, "出典");

  const normalized: Question = {
    id,
    examScopeId: baseQuestion.examScopeId,
    category: requiredText(candidate.category, "カテゴリ", QUESTION_LIMITS.shortText),
    ...(subcategory ? { subcategory } : {}),
    text,
    questionType: type,
    choices,
    answerIndex,
    ...(answerIndices ? { answerIndices } : {}),
    ...(acceptedAnswers ? { acceptedAnswers } : {}),
    explanation: requiredText(candidate.explanation, "解説"),
    ...(source ? { source } : {}),
    tags,
    weight: candidate.weight,
    difficulty: candidate.difficulty,
  };
  const errors = questionValidationErrors(normalized);
  if (errors.length > 0) throw new Error(errors[0]);
  return normalized;
};

export const parseSimilarQuestionDraft = (
  jsonText: string,
  baseQuestion: Question,
  existingQuestions: Question[],
): Question => {
  let value: unknown;
  try {
    value = JSON.parse(stripCodeFence(jsonText));
  } catch {
    throw new Error("類似問題案をJSONとして読み取れません。");
  }
  if (!isRecord(value)) throw new Error("JSONオブジェクトを貼り付けてください。");

  const type = parseQuestionType(value.questionType, questionTypeOf(baseQuestion));
  const rawTags = value.tags ?? [];
  if (!Array.isArray(rawTags) || !rawTags.every((tag) => typeof tag === "string")) {
    throw new Error("tagsは文字列配列で指定してください。");
  }

  let choices: string[] = [];
  let answerIndex = 0;
  let answerIndices: number[] | undefined;
  let acceptedAnswers: string[] | undefined;
  if (type === "text") {
    if (
      !Array.isArray(value.acceptedAnswers) ||
      !value.acceptedAnswers.every((answer) => typeof answer === "string")
    ) {
      throw new Error("acceptedAnswersは文字列配列で指定してください。");
    }
    acceptedAnswers = value.acceptedAnswers as string[];
  } else {
    if (!Array.isArray(value.choices)) {
      throw new Error("choicesは配列で指定してください。");
    }
    choices = value.choices as string[];
    if (type === "multiple") {
      if (!Array.isArray(value.answerNumbers) || value.answerNumbers.length === 0) {
        throw new Error("answerNumbersは1件以上の整数配列で指定してください。");
      }
      const numbers = value.answerNumbers.map((answer, index) =>
        numberInRange(answer, `answerNumbers[${index}]`, 1, choices.length),
      );
      if (new Set(numbers).size !== numbers.length)
        throw new Error("answerNumbersに重複があります。");
      answerIndices = numbers.map((answer) => answer - 1).sort((a, b) => a - b);
      answerIndex = answerIndices[0] ?? 0;
    } else {
      answerIndex = numberInRange(
        value.answerNumber,
        "answerNumber",
        1,
        choices.length,
      ) - 1;
    }
  }

  return validateSimilarQuestion(
    {
      id: createUniqueId(baseQuestion.id, existingQuestions),
      examScopeId: baseQuestion.examScopeId,
      category: requiredText(value.category, "カテゴリ", QUESTION_LIMITS.shortText),
      subcategory: optionalText(
        value.subcategory,
        "サブカテゴリ",
        QUESTION_LIMITS.shortText,
      ),
      text: requiredText(value.text, "問題文"),
      questionType: type,
      choices,
      answerIndex,
      ...(answerIndices ? { answerIndices } : {}),
      ...(acceptedAnswers ? { acceptedAnswers } : {}),
      explanation: requiredText(value.explanation, "解説"),
      source: optionalText(value.source, "出典"),
      tags: rawTags as string[],
      weight: numberInRange(value.weight, "重要度", 1, 5),
      difficulty: numberInRange(value.difficulty, "難易度", 1, 5),
    },
    baseQuestion,
    existingQuestions,
  );
};
