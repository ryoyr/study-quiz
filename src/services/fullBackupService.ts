

import { isActiveSessionSnapshot } from "./activeSessionStorage.ts";
import {
  BACKUP_STORAGE_DEFINITIONS,
  STORAGE_KEYS,
} from "./storageKeyRegistry.ts";
import { validateSetup } from "./setupValidation.ts";
import { normalizeSetup } from "./setupStorage.ts";
import { CURRENT_STORAGE_SCHEMA_VERSION } from "./storageMigration.ts";
import { LPIC101_EXAM_SCOPE_ID } from "../types/ExamScope";
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
  version: 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  appVersion: string;
  exportedAt: string;
  entries: Record<string, string>;
  sourceVersion?: 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  integrity?: BackupIntegrity;
}

export interface BackupIntegrity {
  algorithm: "FNV-1A-32";
  checksum: string;
}

export interface StorageAuditEntry {
  key: string;
  label: string;
  included: boolean;
  bytes: number;
}

export interface StorageAuditReport {
  ok: boolean;
  checkedAt: string;
  includedCount: number;
  totalBytes: number;
  issues: string[];
  entries: StorageAuditEntry[];
}

export interface BackupEntryDefinition {
  key: string;
  label: string;
  required: boolean;
  storageFormat: BackupStorageFormat;
}

const toBackupStorageFormat = (
  format: "json" | "number" | "internal",
): BackupStorageFormat => {
  if (format === "internal")
    throw new Error("内部保存領域はバックアップへ含められません。");
  return format;
};

export const BACKUP_ENTRIES: BackupEntryDefinition[] =
  BACKUP_STORAGE_DEFINITIONS.map(({ key, label, format }) => ({
    key,
    label,
    required: false,
    storageFormat: toBackupStorageFormat(format),
  }));

const APP_VERSION = "4.1.0";
const CURRENT_BACKUP_VERSION = 9 as const;
const SUPPORTED_BACKUP_VERSIONS = [2, 3, 4, 5, 6, 7, 8, 9] as const;
const LEGACY_HISTORY_KEY = STORAGE_KEYS.legacyHistory;
const API_KEY = STORAGE_KEYS.geminiApiKey;
const LEGACY_MODEL_KEY = STORAGE_KEYS.geminiModel;
const definitionsByKey = new Map(
  BACKUP_ENTRIES.map((item) => [item.key, item]),
);
const supportedKeys = new Set([
  ...definitionsByKey.keys(),
  LEGACY_HISTORY_KEY,
  API_KEY,
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

const canonicalBackupPayload = (backup: Pick<FullBackupFile, "format" | "version" | "appVersion" | "exportedAt" | "entries">): string =>
  JSON.stringify({
    format: backup.format,
    version: backup.version,
    appVersion: backup.appVersion,
    exportedAt: backup.exportedAt,
    entries: Object.fromEntries(
      Object.entries(backup.entries).sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    ),
  });

const fnv1a32 = (value: string): string => {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
};

const createIntegrity = (
  backup: Pick<FullBackupFile, "format" | "version" | "appVersion" | "exportedAt" | "entries">,
): BackupIntegrity => ({
  algorithm: "FNV-1A-32",
  checksum: fnv1a32(canonicalBackupPayload(backup)),
});

const verifyIntegrity = (
  backup: Pick<FullBackupFile, "format" | "version" | "appVersion" | "exportedAt" | "entries">,
  integrity: unknown,
): void => {
  if (
    !isObject(integrity) ||
    integrity.algorithm !== "FNV-1A-32" ||
    typeof integrity.checksum !== "string" ||
    !/^[0-9a-f]{8}$/u.test(integrity.checksum)
  ) {
    throw new Error("バックアップの整合性情報がありません。");
  }
  const expected = createIntegrity(backup).checksum;
  if (integrity.checksum !== expected) {
    throw new Error("バックアップの内容が出力後に変更または破損しています。");
  }
};

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
  if (!isString(value.examScopeId, 200) || !value.examScopeId.trim()) return false;
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
  const setup = normalizeSetup(value as Partial<Setup>);
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
    case STORAGE_KEYS.setup:
      validateSetupEntry(value);
      return;
    case STORAGE_KEYS.questions: {
      const items = assertArray(value, "問題");
      if (!items.every(isQuestion)) throw new Error("問題データが不正です。");
      assertUnique(
        items.map((item) => (item as Question).id),
        "問題データ",
      );
      return;
    }
    case STORAGE_KEYS.answerHistory: {
      const items = assertArray(value, "回答履歴");
      if (!items.every(isStudyHistory)) throw new Error("回答履歴が不正です。");
      assertUnique(
        items.map((item) => (item as StudyHistory).id),
        "回答履歴",
      );
      return;
    }
    case STORAGE_KEYS.questionStates: {
      const items = assertArray(value, "問題状態");
      if (!items.every(isQuestionState))
        throw new Error("問題状態・FSRSが不正です。");
      assertUnique(
        items.map((item) => (item as QuestionState).questionId),
        "問題状態",
      );
      return;
    }
    case STORAGE_KEYS.activeSession:
      if (!isActiveSessionSnapshot(value))
        throw new Error("中断中の学習データが不正です。");
      return;
    case STORAGE_KEYS.mistakeNotes: {
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
    case STORAGE_KEYS.questionAnnotations: {
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
    case STORAGE_KEYS.correctionSuggestions: {
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
    case STORAGE_KEYS.aiPromptTemplates: {
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
      definition.key === STORAGE_KEYS.schemaVersion
        ? Number.isInteger(value) &&
          value >= 1 &&
          value <= CURRENT_STORAGE_SCHEMA_VERSION
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
  const rawQuestions = entries[STORAGE_KEYS.questions];
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
  check(STORAGE_KEYS.answerHistory, "回答履歴", (item) => item.questionId);
  check(STORAGE_KEYS.questionStates, "問題状態", (item) => item.questionId);
  check(
    STORAGE_KEYS.mistakeNotes,
    "間違いノート",
    (item) => item.questionId,
  );
  check(
    STORAGE_KEYS.questionAnnotations,
    "お気に入り・メモ",
    (item) => item.questionId,
  );
  check(
    STORAGE_KEYS.correctionSuggestions,
    "問題修正提案",
    (item) => item.questionId,
  );

  const active = entries[STORAGE_KEYS.activeSession];
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

export const createFullBackup = (
  storage: StorageLike = localStorage,
): FullBackupFile => {
  const entries: Record<string, string> = {};
  BACKUP_ENTRIES.forEach(({ key }) => {
    const value = storage.getItem(key);
    if (value !== null) entries[key] = value;
  });
  const backup: FullBackupFile = {
    format: "study-quiz-full-backup",
    version: CURRENT_BACKUP_VERSION,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    entries,
  };
  backup.integrity = createIntegrity(backup);
  return backup;
};

export const downloadFullBackup = (): void => {
  const backup = createFullBackup();
  // 自分自身で再読込できることを確認してから、利用者へファイルを渡す。
  parseFullBackup(JSON.stringify(backup));
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
    !SUPPORTED_BACKUP_VERSIONS.includes(
      (value.version ?? 0) as (typeof SUPPORTED_BACKUP_VERSIONS)[number],
    ) ||
    !isObject(value.entries)
  )
    throw new Error("対応していないバックアップ形式です。");

  const sourceVersion = value.version as FullBackupFile["version"];
  const appVersion =
    typeof value.appVersion === "string" ? value.appVersion : "legacy";
  const exportedAt = normalizeExportedAt(value.exportedAt);
  const originalEntries = { ...value.entries } as Record<string, string>;
  for (const [key, entry] of Object.entries(originalEntries)) {
    if (typeof entry !== "string")
      throw new Error(`${key} のデータ形式が不正です。`);
  }
  if (sourceVersion === CURRENT_BACKUP_VERSION) {
    verifyIntegrity(
      {
        format: "study-quiz-full-backup",
        version: sourceVersion,
        appVersion,
        exportedAt,
        entries: originalEntries,
      },
      value.integrity,
    );
  }

  const entries = { ...originalEntries };
  if (!entries[STORAGE_KEYS.answerHistory] && entries[LEGACY_HISTORY_KEY]) {
    entries[STORAGE_KEYS.answerHistory] = entries[LEGACY_HISTORY_KEY];
  }
  delete entries[LEGACY_HISTORY_KEY];
  delete entries[API_KEY];
  delete entries[LEGACY_MODEL_KEY];

  // 旧版には試験枠・複数選択の出題初期値がない場合があるため、復元前に現行形式へ補完する。
  if (entries[STORAGE_KEYS.setup]) {
    entries[STORAGE_KEYS.setup] = JSON.stringify(
      normalizeSetup(JSON.parse(entries[STORAGE_KEYS.setup]) as Partial<Setup>),
    );
  }
  if (entries[STORAGE_KEYS.questions]) {
    entries[STORAGE_KEYS.questions] = JSON.stringify(
      (JSON.parse(entries[STORAGE_KEYS.questions]) as Array<Record<string, unknown>>).map(
        (item) => ({ ...item, examScopeId: typeof item.examScopeId === "string" && item.examScopeId ? item.examScopeId : LPIC101_EXAM_SCOPE_ID }),
      ),
    );
  }

  for (const [key, entry] of Object.entries(entries)) {
    if (!supportedKeys.has(key))
      throw new Error(`未対応の保存領域が含まれています: ${key}`);
    if (typeof entry !== "string")
      throw new Error(`${key} のデータ形式が不正です。`);
    const definition = definitionsByKey.get(key);
    if (definition) validateStoredEntry(definition, entry);
  }
  validateReferences(entries);

  const normalized: FullBackupFile = {
    format: "study-quiz-full-backup",
    version: CURRENT_BACKUP_VERSION,
    sourceVersion,
    appVersion,
    exportedAt,
    entries,
  };
  normalized.integrity = createIntegrity(normalized);
  return normalized;
};

export const restoreFullBackup = (
  backup: FullBackupFile,
  storage: StorageLike = localStorage,
): void => {
  if (backup.version === CURRENT_BACKUP_VERSION) {
    verifyIntegrity(backup, backup.integrity);
  }
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

export const auditStorage = (
  storage: StorageLike = localStorage,
): StorageAuditReport => {
  const checkedAt = new Date().toISOString();
  try {
    const backup = createFullBackup(storage);
    parseFullBackup(JSON.stringify(backup));
    const entries = BACKUP_ENTRIES.map(({ key, label }) => {
      const value = backup.entries[key];
      return {
        key,
        label,
        included: value !== undefined,
        bytes: value === undefined ? 0 : new Blob([value]).size,
      };
    });
    return {
      ok: true,
      checkedAt,
      includedCount: entries.filter((entry) => entry.included).length,
      totalBytes: entries.reduce((sum, entry) => sum + entry.bytes, 0),
      issues: [],
      entries,
    };
  } catch (error) {
    return {
      ok: false,
      checkedAt,
      includedCount: 0,
      totalBytes: 0,
      issues: [errorMessage(error)],
      entries: [],
    };
  }
};

export const backupErrorMessage = errorMessage;

