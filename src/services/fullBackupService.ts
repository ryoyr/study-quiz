

import { isActiveSessionSnapshot } from "./activeSessionStorage.ts";
import { validateSetup } from "./setupValidation.ts";
import {
  executeStorageTransaction,
  type StorageLike,
} from "./storageTransaction.ts";
import type { Question } from "../types/Question";
import type { QuestionState } from "../types/QuestionState";
import type { Setup } from "../types/Setup";
import type { StudyHistory } from "../types/StudyHistory";

export type BackupStorageFormat = "json" | "number";

export interface FullBackupFile {
  format: "study-quiz-full-backup";
  version: 2 | 3 | 4 | 5;
  appVersion: string;
  exportedAt: string;
  entries: Record<string, string>;
}

export interface BackupEntryDefinition {
  key: string;
  label: string;
  required: boolean;
  storageFormat: BackupStorageFormat;
}

export const BACKUP_ENTRIES: BackupEntryDefinition[] = [
  {
    key: "study-quiz-schema-version",
    label: "データ形式",
    required: false,
    storageFormat: "number",
  },
  {
    key: "study-quiz-setup-v1",
    label: "設定",
    required: false,
    storageFormat: "json",
  },
  {
    key: "study-quiz-questions-v1",
    label: "問題",
    required: false,
    storageFormat: "json",
  },
  {
    key: "study-quiz-answer-history-v1",
    label: "回答履歴",
    required: false,
    storageFormat: "json",
  },
  {
    key: "study-quiz-question-states-v1",
    label: "問題状態・FSRS",
    required: false,
    storageFormat: "json",
  },
  {
    key: "study-quiz-mistake-notes-v1",
    label: "間違いノート",
    required: false,
    storageFormat: "json",
  },
  {
    key: "study-quiz-question-annotations-v1",
    label: "お気に入り・メモ",
    required: false,
    storageFormat: "json",
  },
  {
    key: "study-quiz-correction-suggestions-v1",
    label: "問題修正提案",
    required: false,
    storageFormat: "json",
  },
  {
    key: "study-quiz-ai-prompt-templates-v1",
    label: "AI質問テンプレート",
    required: false,
    storageFormat: "json",
  },
  {
    key: "study-quiz-daily-time-budget-v1",
    label: "1日の学習時間上限",
    required: false,
    storageFormat: "number",
  },
  {
    key: "study-quiz-active-session-v1",
    label: "中断中の学習",
    required: false,
    storageFormat: "json",
  },
];

const APP_VERSION = "1.1.1";
const LEGACY_HISTORY_KEY = "study-quiz-history-v1";
const API_KEY = "study-quiz-gemini-api-key-v1";
const LEGACY_MODEL_KEY = "study-quiz-gemini-model-v1";
const definitionsByKey = new Map(
  BACKUP_ENTRIES.map((item) => [item.key, item]),
);
const supportedKeys = new Set([
  ...definitionsByKey.keys(),
  LEGACY_HISTORY_KEY,
  LEGACY_MODEL_KEY,
]);
const isoDate = (value: unknown): value is string =>
  typeof value === "string" && Number.isFinite(Date.parse(value));
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isString = (value: unknown, max = 20_000): value is string =>
  typeof value === "string" && value.length <= max;
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const isNonNegativeInteger = (value: unknown): value is number =>
  Number.isInteger(value) && Number(value) >= 0;
const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const assertArray = (value: unknown, label: string): unknown[] => {
  if (!Array.isArray(value)) throw new Error(`${label}は配列ではありません。`);
  if (value.length > 100_000)
    throw new Error(`${label}の件数が上限を超えています。`);
  return value;
};

const assertUnique = (values: string[], label: string): void => {
  if (new Set(values).size !== values.length)
    throw new Error(`${label}に重複IDがあります。`);
};

const isQuestion = (value: unknown): value is Question => {
  if (!isObject(value)) return false;
  if (!isString(value.id, 200) || !value.id.trim()) return false;
  if (!isString(value.category, 200) || !value.category.trim()) return false;
  if (!isString(value.text) || !value.text.trim()) return false;
  if (
    !Array.isArray(value.choices) ||
    value.choices.length < 2 ||
    value.choices.length > 8
  )
    return false;
  if (
    !value.choices.every((choice) => isString(choice, 10_000) && choice.trim())
  )
    return false;
  if (
    !Number.isInteger(value.answerIndex) ||
    Number(value.answerIndex) < 0 ||
    Number(value.answerIndex) >= value.choices.length
  )
    return false;
  if (!isString(value.explanation)) return false;
  if (!isFiniteNumber(value.weight) || value.weight <= 0) return false;
  if (
    !Number.isInteger(value.difficulty) ||
    Number(value.difficulty) < 1 ||
    Number(value.difficulty) > 5
  )
    return false;
  if (
    value.tags !== undefined &&
    (!Array.isArray(value.tags) ||
      !value.tags.every((tag) => isString(tag, 200)))
  )
    return false;
  if (value.archivedAt !== undefined && !isoDate(value.archivedAt))
    return false;
  return true;
};

const isStudyHistory = (value: unknown): value is StudyHistory => {
  if (!isObject(value)) return false;
  return (
    isString(value.id, 200) &&
    Boolean(value.id) &&
    isString(value.questionId, 200) &&
    Boolean(value.questionId) &&
    isString(value.category, 200) &&
    Number.isInteger(value.selectedIndex) &&
    isFiniteNumber(value.responseTimeSeconds) &&
    value.responseTimeSeconds >= 0 &&
    isFiniteNumber(value.instantScore) &&
    value.instantScore >= 0 &&
    value.instantScore <= 1 &&
    typeof value.correct === "boolean" &&
    isoDate(value.answeredAt) &&
    (value.fsrsRating === undefined ||
      ["AGAIN", "HARD", "GOOD", "EASY"].includes(String(value.fsrsRating)))
  );
};

const isQuestionState = (value: unknown): value is QuestionState => {
  if (!isObject(value) || !isString(value.questionId, 200) || !value.questionId)
    return false;
  const counters = ["correctCount", "incorrectCount", "totalCount"];
  const metrics = [
    "averageResponseTimeSeconds",
    "recentResponseTimeSeconds",
    "averageInstantScore",
    "recentInstantScore",
    "fsrsStability",
    "fsrsDifficulty",
  ];
  if (!counters.every((key) => isNonNegativeInteger(value[key]))) return false;
  if (
    !metrics.every(
      (key) => isFiniteNumber(value[key]) && Number(value[key]) >= 0,
    )
  )
    return false;
  if (
    Number(value.averageInstantScore) > 1 ||
    Number(value.recentInstantScore) > 1
  )
    return false;
  if (typeof value.recentIncorrect !== "boolean") return false;
  if (
    !["UNLEARNED", "LEARNING", "MASTERED"].includes(String(value.masteryLevel))
  )
    return false;
  if (value.lastAnsweredAt !== null && !isoDate(value.lastAnsweredAt))
    return false;
  if (value.nextReviewAt !== null && !isoDate(value.nextReviewAt)) return false;
  return value.fsrsCard === null || isObject(value.fsrsCard);
};

const validateSetupEntry = (value: unknown): void => {
  if (!isObject(value)) throw new Error("設定の形式が不正です。");
  const setup = value as unknown as Setup;
  if (Object.keys(validateSetup(setup)).length > 0)
    throw new Error("設定値が不正です。");
  if (
    typeof setup.setupCompleted !== "boolean" ||
    !isoDate(setup.createdAt) ||
    !isoDate(setup.updatedAt)
  ) {
    throw new Error("設定の管理情報が不正です。");
  }
};

const validateJsonEntry = (key: string, value: unknown): void => {
  switch (key) {
    case "study-quiz-setup-v1":
      validateSetupEntry(value);
      return;
    case "study-quiz-questions-v1": {
      const items = assertArray(value, "問題");
      if (!items.every(isQuestion)) throw new Error("問題データが不正です。");
      assertUnique(
        items.map((item) => (item as Question).id),
        "問題データ",
      );
      return;
    }
    case "study-quiz-answer-history-v1": {
      const items = assertArray(value, "回答履歴");
      if (!items.every(isStudyHistory)) throw new Error("回答履歴が不正です。");
      assertUnique(
        items.map((item) => (item as StudyHistory).id),
        "回答履歴",
      );
      return;
    }
    case "study-quiz-question-states-v1": {
      const items = assertArray(value, "問題状態");
      if (!items.every(isQuestionState))
        throw new Error("問題状態・FSRSが不正です。");
      assertUnique(
        items.map((item) => (item as QuestionState).questionId),
        "問題状態",
      );
      return;
    }
    case "study-quiz-active-session-v1":
      if (!isActiveSessionSnapshot(value))
        throw new Error("中断中の学習データが不正です。");
      return;
    case "study-quiz-mistake-notes-v1": {
      const items = assertArray(value, "間違いノート");
      if (
        !items.every(
          (item) =>
            isObject(item) &&
            isString(item.questionId, 200) &&
            isString(item.cause) &&
            isString(item.correctKnowledge) &&
            isString(item.caution) &&
            isoDate(item.updatedAt),
        )
      ) {
        throw new Error("間違いノートが不正です。");
      }
      return;
    }
    case "study-quiz-question-annotations-v1": {
      const items = assertArray(value, "お気に入り・メモ");
      if (
        !items.every(
          (item) =>
            isObject(item) &&
            isString(item.questionId, 200) &&
            typeof item.favorite === "boolean" &&
            isString(item.memo) &&
            isoDate(item.updatedAt),
        )
      ) {
        throw new Error("お気に入り・メモが不正です。");
      }
      return;
    }
    case "study-quiz-correction-suggestions-v1": {
      const items = assertArray(value, "問題修正提案");
      if (
        !items.every(
          (item) =>
            isObject(item) &&
            isString(item.id, 200) &&
            isString(item.questionId, 200) &&
            isString(item.suggestion) &&
            isString(item.reason) &&
            isString(item.reference) &&
            ["pending", "approved", "rejected"].includes(String(item.status)) &&
            isoDate(item.createdAt) &&
            isoDate(item.updatedAt),
        )
      ) {
        throw new Error("問題修正提案が不正です。");
      }
      return;
    }
    case "study-quiz-ai-prompt-templates-v1": {
      const items = assertArray(value, "AI質問テンプレート");
      if (
        !items.every(
          (item) =>
            isObject(item) &&
            isString(item.id, 200) &&
            isString(item.name, 200) &&
            isString(item.description) &&
            isString(item.template) &&
            typeof item.builtIn === "boolean" &&
            isoDate(item.createdAt) &&
            isoDate(item.updatedAt),
        )
      ) {
        throw new Error("AI質問テンプレートが不正です。");
      }
      return;
    }
    default:
      throw new Error(`未対応のJSON保存領域です: ${key}`);
  }
};

const validateStoredEntry = (
  definition: BackupEntryDefinition,
  raw: string,
): void => {
  if (new Blob([raw]).size > 25 * 1024 * 1024)
    throw new Error(`${definition.label}の容量が上限を超えています。`);
  if (definition.storageFormat === "number") {
    const value = Number(raw);
    const valid =
      definition.key === "study-quiz-schema-version"
        ? Number.isInteger(value) && value >= 1 && value <= 5
        : Number.isFinite(value) && value >= 0 && value <= 480;
    if (!valid) throw new Error(`${definition.label}の値が不正です。`);
    return;
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error(`${definition.label}のJSONが不正です。`);
  }
  validateJsonEntry(definition.key, value);
};

const validateReferences = (entries: Record<string, string>): void => {
  const rawQuestions = entries["study-quiz-questions-v1"];
  if (!rawQuestions) return;
  const questionIds = new Set(
    (JSON.parse(rawQuestions) as Question[]).map((item) => item.id),
  );
  const check = (
    key: string,
    label: string,
    id: (item: Record<string, unknown>) => unknown,
  ) => {
    const raw = entries[key];
    if (!raw) return;
    const invalid = (JSON.parse(raw) as Record<string, unknown>[]).find(
      (item) => !questionIds.has(String(id(item))),
    );
    if (invalid) throw new Error(`${label}が存在しない問題を参照しています。`);
  };
  check("study-quiz-answer-history-v1", "回答履歴", (item) => item.questionId);
  check("study-quiz-question-states-v1", "問題状態", (item) => item.questionId);
  check(
    "study-quiz-mistake-notes-v1",
    "間違いノート",
    (item) => item.questionId,
  );
  check(
    "study-quiz-question-annotations-v1",
    "お気に入り・メモ",
    (item) => item.questionId,
  );
  check(
    "study-quiz-correction-suggestions-v1",
    "問題修正提案",
    (item) => item.questionId,
  );

  const active = entries["study-quiz-active-session-v1"];
  if (active) {
    const snapshot = JSON.parse(active) as { questionIds: string[] };
    if (snapshot.questionIds.some((id) => !questionIds.has(id))) {
      throw new Error("中断中の学習が存在しない問題を参照しています。");
    }
  }
};

const normalizeExportedAt = (value: unknown): string => {
  if (value === undefined) return new Date().toISOString();
  if (!isoDate(value)) throw new Error("バックアップの出力日時が不正です。");
  return value;
};

export const createFullBackup = (): FullBackupFile => {
  const entries: Record<string, string> = {};
  BACKUP_ENTRIES.forEach(({ key }) => {
    const value = localStorage.getItem(key);
    if (value !== null) entries[key] = value;
  });
  return {
    format: "study-quiz-full-backup",
    version: 5,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    entries,
  };
};

export const downloadFullBackup = (): void => {
  const backup = createFullBackup();
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const stamp = backup.exportedAt.replace(/[:.]/g, "-");
  anchor.href = url;
  anchor.download = `study-quiz-full-backup-${stamp}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

export const parseFullBackup = (text: string): FullBackupFile => {
  if (new Blob([text]).size > 25 * 1024 * 1024) {
    throw new Error("バックアップは25MB以下のJSONファイルを指定してください。");
  }
  let value: Partial<FullBackupFile>;
  try {
    value = JSON.parse(text) as Partial<FullBackupFile>;
  } catch {
    throw new Error("JSONファイルを読み取れません。");
  }

  if (
    value.format !== "study-quiz-full-backup" ||
    ![2, 3, 4, 5].includes(value.version ?? 0) ||
    !isObject(value.entries)
  )
    throw new Error("対応していないバックアップ形式です。");

  const entries = { ...value.entries } as Record<string, string>;
  if (!entries["study-quiz-answer-history-v1"] && entries[LEGACY_HISTORY_KEY]) {
    entries["study-quiz-answer-history-v1"] = entries[LEGACY_HISTORY_KEY];
  }
  delete entries[LEGACY_HISTORY_KEY];
  delete entries[API_KEY];
  delete entries[LEGACY_MODEL_KEY];

  for (const [key, entry] of Object.entries(entries)) {
    if (!supportedKeys.has(key))
      throw new Error(`未対応の保存領域が含まれています: ${key}`);
    if (typeof entry !== "string")
      throw new Error(`${key} のデータ形式が不正です。`);
    const definition = definitionsByKey.get(key);
    if (definition) validateStoredEntry(definition, entry);
  }
  validateReferences(entries);

  return {
    format: "study-quiz-full-backup",
    version: 5,
    appVersion:
      typeof value.appVersion === "string" ? value.appVersion : "legacy",
    exportedAt: normalizeExportedAt(value.exportedAt),
    entries,
  };
};

export const restoreFullBackup = (
  backup: FullBackupFile,
  storage: StorageLike = localStorage,
): void => {
  for (const [key, raw] of Object.entries(backup.entries)) {
    const definition = definitionsByKey.get(key);
    if (!definition) throw new Error(`未対応の保存領域です: ${key}`);
    validateStoredEntry(definition, raw);
  }
  validateReferences(backup.entries);

  executeStorageTransaction(
    [
      ...BACKUP_ENTRIES.map(({ key }) => ({
        key,
        value: backup.entries[key] ?? null,
      })),
      { key: LEGACY_HISTORY_KEY, value: null },
      { key: API_KEY, value: null },
      { key: LEGACY_MODEL_KEY, value: null },
    ],
    storage,
  );
};

export const inspectBackup = (backup: FullBackupFile) =>
  BACKUP_ENTRIES.map((item) => ({
    label: item.label,
    included: Object.hasOwn(backup.entries, item.key),
    bytes: new Blob([backup.entries[item.key] ?? ""]).size,
  }));

export const backupErrorMessage = errorMessage;
