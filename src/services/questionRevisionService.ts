import type { Question } from "../types/Question";
import type {
  QuestionRevision,
  QuestionRevisionSource,
} from "../types/QuestionRevision";
import { isQuestion } from "./questionValidation";
import { STORAGE_KEYS } from "./storageKeyRegistry";
import { writeStorageValue } from "./verifiedStorage";

const MAX_REVISIONS = 20_000;
const FIELD_NAMES: Array<keyof Question> = [
  "examScopeId",
  "category",
  "subcategory",
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
  "archivedAt",
];

export const changedQuestionFields = (
  before: Question | null,
  after: Question,
): string[] =>
  before === null
    ? FIELD_NAMES.map(String)
    : FIELD_NAMES.filter(
        (field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]),
      ).map(String);

export const isQuestionRevision = (value: unknown): value is QuestionRevision => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Partial<QuestionRevision>;
  return (
    typeof item.id === "string" &&
    item.id.trim().length > 0 &&
    typeof item.questionId === "string" &&
    item.questionId.trim().length > 0 &&
    ["manual", "quality-proposal", "correction-suggestion", "import", "master-sync"].includes(
      String(item.source),
    ) &&
    typeof item.summary === "string" &&
    Array.isArray(item.changedFields) &&
    item.changedFields.every((field) => typeof field === "string") &&
    (item.before === null || isQuestion(item.before)) &&
    isQuestion(item.after) &&
    item.after.id === item.questionId &&
    (item.before === null || item.before.id === item.questionId) &&
    typeof item.createdAt === "string" &&
    Number.isFinite(Date.parse(item.createdAt)) &&
    (item.proposalId === undefined || typeof item.proposalId === "string")
  );
};

export const loadQuestionRevisions = (): QuestionRevision[] => {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.questionRevisions) ?? "[]",
    );
    return Array.isArray(parsed) ? parsed.filter(isQuestionRevision) : [];
  } catch {
    return [];
  }
};

export const saveQuestionRevisions = (items: QuestionRevision[]): void => {
  if (
    items.length > MAX_REVISIONS ||
    !items.every(isQuestionRevision) ||
    new Set(items.map((item) => item.id)).size !== items.length
  ) {
    throw new Error("問題改訂履歴の形式が不正です。");
  }
  writeStorageValue(STORAGE_KEYS.questionRevisions, JSON.stringify(items));
};

export const createQuestionRevision = (input: {
  before: Question | null;
  after: Question;
  source: QuestionRevisionSource;
  summary: string;
  proposalId?: string;
  createdAt?: string;
}): QuestionRevision => {
  if (!isQuestion(input.after) || (input.before !== null && !isQuestion(input.before)))
    throw new Error("問題改訂履歴へ保存する問題が不正です。");
  if (input.before !== null && input.before.id !== input.after.id)
    throw new Error("問題IDを変更する改訂履歴は作成できません。");
  const revision: QuestionRevision = {
    id: crypto.randomUUID(),
    questionId: input.after.id,
    source: input.source,
    summary: input.summary.trim().slice(0, 500),
    changedFields: changedQuestionFields(input.before, input.after),
    before: input.before === null ? null : structuredClone(input.before),
    after: structuredClone(input.after),
    createdAt: input.createdAt ?? new Date().toISOString(),
    ...(input.proposalId ? { proposalId: input.proposalId } : {}),
  };
  if (!isQuestionRevision(revision)) throw new Error("問題改訂履歴を作成できません。");
  return revision;
};

export const appendQuestionRevision = (
  current: QuestionRevision[],
  revision: QuestionRevision,
): QuestionRevision[] => {
  const next = [revision, ...current].slice(0, MAX_REVISIONS);
  if (!next.every(isQuestionRevision)) throw new Error("問題改訂履歴を追加できません。");
  return next;
};
