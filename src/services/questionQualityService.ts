import type { Question } from "../types/Question";
import type {
  QuestionQualityProposal,
  QuestionQualityProposalInput,
  QuestionSeedUpdatePack,
} from "../types/QuestionQualityProposal";
import {
  answerDefinitionForExternalUse,
  questionTypeOf,
} from "./questionAnswerModel.ts";
import { isQuestion, questionValidationErrors } from "./questionValidation.ts";

const APP_VERSION = "4.6.0";
const MAX_JSON_BYTES = 5 * 1024 * 1024;
const MAX_PROPOSALS = 10_000;
const MAX_TEXT = 20_000;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isNonBlankString = (value: unknown, max = MAX_TEXT): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;
const isOptionalString = (value: unknown, max = MAX_TEXT): value is string | undefined =>
  value === undefined || (typeof value === "string" && value.length <= max);
const isTimestamp = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T/u.test(value) &&
  Number.isFinite(Date.parse(value));
const cloneQuestion = (question: Question): Question => structuredClone(question);
const sameQuestion = (left: Question, right: Question): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const parseJson = (text: string): unknown => {
  if (new Blob([text]).size > MAX_JSON_BYTES)
    throw new Error("JSONファイルは5MB以下にしてください。");
  const trimmed = text.trim();
  const source = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?\s*/iu, "").replace(/\s*```$/u, "")
    : trimmed;
  try {
    return JSON.parse(source) as unknown;
  } catch {
    throw new Error("JSONを読み取れません。");
  }
};

export const createQualityInput = (questions: Question[]) => ({
  format: "study-quiz-question-quality-input" as const,
  version: 1 as const,
  exportedAt: new Date().toISOString(),
  questions: questions.map((question) => ({
    id: question.id,
    examScopeId: question.examScopeId,
    category: question.category,
    subcategory: question.subcategory,
    question: question.text,
    questionType: questionTypeOf(question),
    choices: question.choices,
    answer: answerDefinitionForExternalUse(question),
    explanation: question.explanation,
    source: question.source,
    tags: question.tags,
    weight: question.weight,
    difficulty: question.difficulty,
  })),
});

export const buildQuestionQualityPrompt = (questions: Question[]): string => {
  const input = createQualityInput(questions);
  return `以下の学習問題について、問題文・選択肢・正答定義・解説の品質をレビューしてください。ファクトチェックと同様に推測を避け、一次情報を優先してください。\n\n提案種別:\n- correction: 誤り、曖昧さ、正答不整合、解説の誤記を修正\n- supplement: 正しい内容を維持し、理解に必要な根拠・注意点・補足を追加\n\n修正不要な問題は出力しないでください。proposedには変更する項目だけを含めてください。出力は説明文やMarkdownを付けず、次のJSONオブジェクトだけにしてください。\n\n{"format":"study-quiz-question-quality-proposals","version":1,"proposals":[{"questionId":"ID","kind":"correction|supplement","summary":"提案の要約","reason":"判断理由","reference":"一次情報名またはURL。不明なら空文字","proposed":{"text":"修正後の問題文（任意）","choices":["修正後の選択肢（任意）"],"answerIndex":0,"answerIndices":[0,2],"acceptedAnswers":["許容回答"],"explanation":"修正・補足後の解説（任意）","source":"出典（任意）","tags":["タグ（任意）"],"weight":1,"difficulty":1}}]}\n\n入力JSON:\n${JSON.stringify(input, null, 2)}`;
};

const proposalFromInput = (
  value: unknown,
  index: number,
  questionMap: ReadonlyMap<string, Question>,
  now: string,
): QuestionQualityProposal => {
  if (!isObject(value)) throw new Error(`${index + 1}件目がオブジェクトではありません。`);
  const item = value as unknown as QuestionQualityProposalInput;
  if (!isNonBlankString(item.questionId, 200) || !questionMap.has(item.questionId))
    throw new Error(`${index + 1}件目の問題IDが存在しません。`);
  if (!(["correction", "supplement"] as const).includes(item.kind))
    throw new Error(`${item.questionId} のkindが不正です。`);
  if (!isNonBlankString(item.summary) || !isNonBlankString(item.reason))
    throw new Error(`${item.questionId} のsummaryまたはreasonが不正です。`);
  if (!isOptionalString(item.reference))
    throw new Error(`${item.questionId} のreferenceが長すぎます。`);
  if (!isObject(item.proposed) || Object.keys(item.proposed).length === 0)
    throw new Error(`${item.questionId} のproposedが空です。`);
  const allowedProposedKeys = new Set([
    "text",
    "questionType",
    "choices",
    "answerIndex",
    "answerIndices",
    "acceptedAnswers",
    "explanation",
    "source",
    "tags",
    "weight",
    "difficulty",
  ]);
  const unknownKey = Object.keys(item.proposed).find(
    (key) => !allowedProposedKeys.has(key),
  );
  if (unknownKey)
    throw new Error(`${item.questionId} のproposedに未対応項目があります: ${unknownKey}`);

  const beforeQuestion = cloneQuestion(questionMap.get(item.questionId) as Question);
  const proposedQuestion = {
    ...beforeQuestion,
    ...structuredClone(item.proposed),
    id: beforeQuestion.id,
    examScopeId: beforeQuestion.examScopeId,
    category: beforeQuestion.category,
  } satisfies Question;
  if (beforeQuestion.subcategory !== undefined)
    proposedQuestion.subcategory = beforeQuestion.subcategory;
  else delete proposedQuestion.subcategory;
  if (beforeQuestion.archivedAt !== undefined)
    proposedQuestion.archivedAt = beforeQuestion.archivedAt;
  else delete proposedQuestion.archivedAt;
  const errors = questionValidationErrors(proposedQuestion);
  if (errors.length > 0)
    throw new Error(`${item.questionId} の提案後データが不正です: ${errors.join(" / ")}`);
  if (sameQuestion(beforeQuestion, proposedQuestion))
    throw new Error(`${item.questionId} の提案に実質的な変更がありません。`);

  return {
    id: crypto.randomUUID(),
    questionId: beforeQuestion.id,
    kind: item.kind,
    summary: item.summary.trim(),
    reason: item.reason.trim(),
    reference: item.reference?.trim() ?? "",
    beforeQuestion,
    proposedQuestion,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };
};

export const parseQuestionQualityProposals = (
  text: string,
  questions: Question[],
): QuestionQualityProposal[] => {
  const value = parseJson(text);
  if (!isObject(value) || value.format !== "study-quiz-question-quality-proposals" || value.version !== 1)
    throw new Error("対応していない品質提案JSONです。");
  if (!Array.isArray(value.proposals)) throw new Error("proposalsは配列ではありません。");
  if (value.proposals.length > MAX_PROPOSALS)
    throw new Error("品質提案の件数が上限を超えています。");
  const questionMap = new Map(questions.map((question) => [question.id, question]));
  const now = new Date().toISOString();
  const proposals = value.proposals.map((item, index) =>
    proposalFromInput(item, index, questionMap, now),
  );
  if (new Set(proposals.map((item) => item.questionId)).size !== proposals.length)
    throw new Error("同じ問題IDの品質提案が重複しています。");
  return proposals;
};

export const isQuestionQualityProposal = (
  value: unknown,
): value is QuestionQualityProposal => {
  if (!isObject(value)) return false;
  return (
    isNonBlankString(value.id, 200) &&
    isNonBlankString(value.questionId, 200) &&
    ["correction", "supplement"].includes(String(value.kind)) &&
    isNonBlankString(value.summary) &&
    isNonBlankString(value.reason) &&
    typeof value.reference === "string" &&
    value.reference.length <= MAX_TEXT &&
    isQuestion(value.beforeQuestion) &&
    isQuestion(value.proposedQuestion) &&
    value.beforeQuestion.id === value.questionId &&
    value.proposedQuestion.id === value.questionId &&
    !sameQuestion(value.beforeQuestion, value.proposedQuestion) &&
    ["pending", "applied", "rejected"].includes(String(value.status)) &&
    isTimestamp(value.createdAt) &&
    isTimestamp(value.updatedAt) &&
    (value.reviewedAt === undefined || isTimestamp(value.reviewedAt)) &&
    (value.appliedAt === undefined || isTimestamp(value.appliedAt)) &&
    (value.status !== "applied" || isTimestamp(value.appliedAt))
  );
};

export const createQuestionSeedUpdatePack = (
  proposals: QuestionQualityProposal[],
): QuestionSeedUpdatePack => {
  const latestByQuestion = new Map<string, QuestionQualityProposal>();
  proposals
    .filter((item) => item.status === "applied" && item.appliedAt)
    .sort((left, right) =>
      String(left.appliedAt).localeCompare(String(right.appliedAt)),
    )
    .forEach((item) => latestByQuestion.set(item.questionId, item));
  return {
    format: "study-quiz-question-seed-updates",
    version: 1,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    updates: [...latestByQuestion.values()].map((item) => ({
      questionId: item.questionId,
      proposalId: item.id,
      appliedAt: item.appliedAt as string,
      beforeQuestion: cloneQuestion(item.beforeQuestion),
      question: cloneQuestion(item.proposedQuestion),
    })),
  };
};
