import { isQuestion } from "../../../src/services/questionValidation";
import type { CreateContentPullRequestCommand } from "../../../src/types/QuestionMaster";
import { ApiError } from "./http";
import type { ValidatedCommand } from "./types";

export const MAX_REQUEST_BYTES = 2 * 1024 * 1024;
const MAX_CHANGES = 5_000;
const DATASET_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/u;
const CONTENT_VERSION_PATTERN = /^\d{4}\.\d{2}\.\d{2}\.\d+$/u;
const FINGERPRINT_PATTERN = /^[0-9a-f]{8}$/u;
const IDEMPOTENCY_PATTERN = /^[0-9a-f]{64}$/u;
const FIELD_PATTERN = /^[A-Za-z][A-Za-z0-9]*$/u;
const COMMAND_KEYS = new Set([
  "schemaVersion",
  "baseContentVersion",
  "baseDatasetVersions",
  "changes",
  "title",
  "body",
  "commitMessage",
  "idempotencyKey",
]);
const CHANGE_KEYS = new Set([
  "datasetId",
  "operation",
  "questionId",
  "baseFingerprint",
  "changedFields",
  "before",
  "after",
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort((left, right) => left.localeCompare(right))
      .map((key) => [key, stableValue(value[key])]),
  );
};

export const stableJson = (value: unknown): string => JSON.stringify(stableValue(value));

const sha256 = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const validText = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;

const validDatasetVersions = (value: unknown): value is Record<string, number> =>
  isRecord(value) &&
  Object.keys(value).length > 0 &&
  Object.keys(value).length <= 100 &&
  Object.entries(value).every(
    ([key, version]) => DATASET_ID_PATTERN.test(key) && Number.isInteger(version) && Number(version) > 0,
  );

const isChange = (
  value: unknown,
): value is CreateContentPullRequestCommand["changes"][number] => {
  if (!isRecord(value)) return false;
  if (Object.keys(value).some((key) => !CHANGE_KEYS.has(key))) return false;
  const operation = value.operation;
  const baseFingerprint = value.baseFingerprint;
  return (
    typeof value.datasetId === "string" &&
    DATASET_ID_PATTERN.test(value.datasetId) &&
    ["add", "update", "archive"].includes(String(operation)) &&
    validText(value.questionId, 200) &&
    Array.isArray(value.changedFields) &&
    value.changedFields.length > 0 &&
    value.changedFields.length <= 30 &&
    value.changedFields.every(
      (field) => typeof field === "string" && FIELD_PATTERN.test(field),
    ) &&
    value.questionId === (isRecord(value.after) ? value.after.id : undefined) &&
    isQuestion(value.after) &&
    (operation === "add"
      ? baseFingerprint === undefined
      : typeof baseFingerprint === "string" &&
        FINGERPRINT_PATTERN.test(baseFingerprint)) &&
    (value.before === undefined || isQuestion(value.before)) &&
    (operation !== "archive" ||
      (value.after as { archivedAt?: unknown }).archivedAt !== undefined)
  );
};

export const parseCommand = async (
  rawBody: string,
  headerIdempotencyKey: string | null,
): Promise<ValidatedCommand> => {
  if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
    throw new ApiError(
      413,
      "REQUEST_TOO_LARGE",
      "送信内容が上限を超えています。",
      "変更を複数のPull Requestへ分割してください。",
    );
  }
  let value: unknown;
  try {
    value = JSON.parse(rawBody);
  } catch {
    throw new ApiError(400, "INVALID_JSON", "リクエストがJSONではありません。");
  }
  if (
    !isRecord(value) ||
    Object.keys(value).some((key) => !COMMAND_KEYS.has(key)) ||
    value.schemaVersion !== 1 ||
    typeof value.baseContentVersion !== "string" ||
    !CONTENT_VERSION_PATTERN.test(value.baseContentVersion) ||
    !validDatasetVersions(value.baseDatasetVersions) ||
    !Array.isArray(value.changes) ||
    value.changes.length === 0 ||
    value.changes.length > MAX_CHANGES ||
    !value.changes.every(isChange) ||
    new Set(value.changes.map((change) => (change as { questionId: string }).questionId)).size !== value.changes.length ||
    !validText(value.title, 200) ||
    !validText(value.body, 20_000) ||
    !validText(value.commitMessage, 500) ||
    typeof value.idempotencyKey !== "string" ||
    !IDEMPOTENCY_PATTERN.test(value.idempotencyKey)
  ) {
    throw new ApiError(
      400,
      "INVALID_COMMAND",
      "問題マスターの変更リクエスト形式が不正です。",
      "最新版を取得し、送信前確認からやり直してください。",
    );
  }

  if (headerIdempotencyKey !== value.idempotencyKey) {
    throw new ApiError(400, "IDEMPOTENCY_MISMATCH", "冪等キーが一致しません。");
  }
  const unsigned = {
    schemaVersion: value.schemaVersion,
    baseContentVersion: value.baseContentVersion,
    baseDatasetVersions: value.baseDatasetVersions,
    changes: value.changes,
    title: value.title.trim(),
    body: value.body.trim(),
    commitMessage: value.commitMessage.trim(),
  };
  const expected = await sha256(stableJson(unsigned));
  if (expected !== value.idempotencyKey) {
    throw new ApiError(
      400,
      "INVALID_IDEMPOTENCY_KEY",
      "送信内容と冪等キーが一致しません。",
    );
  }
  return { ...unsigned, idempotencyKey: value.idempotencyKey } as ValidatedCommand;
};
