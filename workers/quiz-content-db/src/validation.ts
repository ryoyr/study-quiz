import type { ApplyCommand, ContentChange, Question } from "./types";

const MAX_CHANGES = 100;
const MAX_TEXT = 20_000;
const VERSION = /^\d{4}\.\d{2}\.\d{2}\.\d+$/u;
const DATASET = /^[a-z0-9][a-z0-9-]{0,63}$/u;
const HASH = /^[0-9a-f]{8}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown, maximum = MAX_TEXT): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= maximum;
const optionalText = (value: unknown, maximum = MAX_TEXT): boolean =>
  value === undefined || (typeof value === "string" && value.length <= maximum);

export const isQuestion = (value: unknown): value is Question => {
  if (!isRecord(value) || "distribution" in value) return false;
  const type = value.questionType ?? "single";
  if (!text(value.id, 200) || !text(value.examScopeId, 200) || !text(value.category, 500) ||
      !optionalText(value.subcategory, 500) || !text(value.text) ||
      !["single", "multiple", "text"].includes(String(type)) ||
      typeof value.explanation !== "string" || value.explanation.length > MAX_TEXT ||
      !optionalText(value.source) || typeof value.weight !== "number" || !Number.isFinite(value.weight) || value.weight <= 0 ||
      !Number.isInteger(value.difficulty) || Number(value.difficulty) < 1 || Number(value.difficulty) > 5 ||
      (value.archivedAt !== undefined && (typeof value.archivedAt !== "string" || !Number.isFinite(Date.parse(value.archivedAt))))) return false;
  if (!Array.isArray(value.choices)) return false;
  const choices = value.choices;
  if (choices.length > 8 || !choices.every((item) => text(item)) ||
      new Set(choices).size !== choices.length) return false;
  if (value.tags !== undefined && (!Array.isArray(value.tags) || value.tags.length > 30 || !value.tags.every((item) => text(item, 500)))) return false;
  if (type === "text") {
    return choices.length === 0 && Array.isArray(value.acceptedAnswers) && value.acceptedAnswers.length > 0 &&
      value.acceptedAnswers.length <= 100 && value.acceptedAnswers.every((item) => text(item));
  }
  if (choices.length < 2 || !Number.isInteger(value.answerIndex) || Number(value.answerIndex) < 0 || Number(value.answerIndex) >= choices.length) return false;
  if (type === "multiple") {
    return Array.isArray(value.answerIndices) && value.answerIndices.length > 0 &&
      new Set(value.answerIndices).size === value.answerIndices.length &&
      value.answerIndices.every((index) => Number.isInteger(index) && Number(index) >= 0 && Number(index) < choices.length);
  }
  return true;
};

const isChange = (value: unknown): value is ContentChange => {
  if (!isRecord(value) || !DATASET.test(String(value.datasetId)) ||
      !["add", "update", "archive"].includes(String(value.operation)) ||
      typeof value.questionId !== "string" || !Array.isArray(value.changedFields) ||
      !value.changedFields.every((item) => typeof item === "string" && item !== "distribution") ||
      !isQuestion(value.after) || value.after.id !== value.questionId) return false;
  if (value.operation === "add") return value.baseFingerprint === undefined;
  return typeof value.baseFingerprint === "string" && HASH.test(value.baseFingerprint);
};

export const parseApplyCommand = (value: unknown, headerKey: string | null): ApplyCommand => {
  if (!isRecord(value) || value.schemaVersion !== 1 ||
      typeof value.baseContentVersion !== "string" || !VERSION.test(value.baseContentVersion) ||
      !isRecord(value.baseDatasetVersions) ||
      !Object.entries(value.baseDatasetVersions).every(([id, version]) => DATASET.test(id) && Number.isInteger(version) && Number(version) > 0) ||
      !Array.isArray(value.changes) || value.changes.length === 0 || value.changes.length > MAX_CHANGES || !value.changes.every(isChange) ||
      typeof value.message !== "string" || !value.message.trim() || value.message.length > 2_000 ||
      typeof value.idempotencyKey !== "string" || !SHA256.test(value.idempotencyKey) ||
      headerKey !== value.idempotencyKey) {
    throw new Error("D1変更コマンドの形式が不正です。");
  }
  const ids = value.changes.map((item) => (item as ContentChange).questionId);
  if (new Set(ids).size !== ids.length) throw new Error("1回の変更内で問題IDが重複しています。");
  return value as unknown as ApplyCommand;
};

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
};
export const stableJson = (value: unknown): string => JSON.stringify(stableValue(value));

export const fingerprint = (question: Question): string => {
  const source = stableJson(question);
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

export const verifyIdempotencyKey = async (command: ApplyCommand): Promise<void> => {
  const { idempotencyKey: _key, ...unsigned } = command;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(stableJson(unsigned)));
  const actual = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  if (actual !== command.idempotencyKey) throw new Error("冪等キーと送信内容が一致しません。");
};
