import {
  executeStorageTransaction,
  type StorageLike,
} from "./storageTransaction.ts";
import { STORAGE_KEYS } from "./storageKeyRegistry.ts";
import type { StudyHistory } from "../types/StudyHistory.ts";

const LEGACY_HISTORY_KEY = STORAGE_KEYS.legacyHistory;
const HISTORY_KEY = STORAGE_KEYS.answerHistory;
const SCHEMA_KEY = STORAGE_KEYS.schemaVersion;
export const CURRENT_STORAGE_SCHEMA_VERSION = 9;

const defaultStorage = (): StorageLike => {
  if (!("localStorage" in globalThis)) {
    throw new Error("この環境では端末内ストレージを利用できません。");
  }
  return globalThis.localStorage;
};

const parseJsonArray = (value: string | null): unknown[] | null => {
  if (value === null) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const isHistoryItem = (value: unknown): value is StudyHistory => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Partial<StudyHistory>;
  return (
    typeof item.id === "string" &&
    item.id.trim().length > 0 &&
    item.id.length <= 200 &&
    typeof item.questionId === "string" &&
    item.questionId.trim().length > 0 &&
    item.questionId.length <= 200 &&
    typeof item.category === "string" &&
    item.category.length <= 200 &&
    Number.isInteger(item.selectedIndex) &&
    Number(item.selectedIndex) >= -1 &&
    typeof item.correct === "boolean" &&
    typeof item.answeredAt === "string" &&
    /^\d{4}-\d{2}-\d{2}T/u.test(item.answeredAt) &&
    Number.isFinite(Date.parse(item.answeredAt)) &&
    typeof item.responseTimeSeconds === "number" &&
    Number.isFinite(item.responseTimeSeconds) &&
    item.responseTimeSeconds >= 0 &&
    typeof item.instantScore === "number" &&
    Number.isFinite(item.instantScore) &&
    item.instantScore >= 0 &&
    item.instantScore <= 1
  );
};

const isHistoryArray = (items: unknown[] | null): items is StudyHistory[] =>
  items !== null &&
  items.length <= 100_000 &&
  items.every(isHistoryItem) &&
  new Set(items.map((item) => item.id)).size === items.length;

/** 旧キーを現行キーへ一度だけ移行し、移行途中の失敗時は元へ戻す。 */
export const migrateLegacyStorage = (
  storage: StorageLike = defaultStorage(),
): boolean => {
  const legacyHistory = storage.getItem(LEGACY_HISTORY_KEY);
  const currentHistory = storage.getItem(HISTORY_KEY);
  const currentSchema = storage.getItem(SCHEMA_KEY);
  const targetSchema = String(CURRENT_STORAGE_SCHEMA_VERSION);
  const parsedLegacyItems = parseJsonArray(legacyHistory);
  const parsedCurrentItems = parseJsonArray(currentHistory);
  const legacyItems = isHistoryArray(parsedLegacyItems)
    ? parsedLegacyItems
    : null;
  const currentItems = isHistoryArray(parsedCurrentItems)
    ? parsedCurrentItems
    : null;

  if (legacyHistory !== null && legacyItems === null) {
    throw new Error(
      "旧回答履歴が破損しているため自動移行を停止しました。旧データを削除せず保持しています。",
    );
  }
  if (
    legacyHistory !== null &&
    legacyItems !== null &&
    legacyItems.length > 0 &&
    currentItems !== null &&
    currentItems.length > 0 &&
    currentHistory !== legacyHistory
  ) {
    throw new Error(
      "現行履歴と旧回答履歴の内容が競合しているため自動移行を停止しました。両方のデータを保持しています。",
    );
  }

  const mutations = [] as Array<{ key: string; value: string | null }>;
  if (legacyHistory !== null && legacyItems !== null) {
    const currentCanBeReplaced =
      currentItems === null ||
      (currentItems.length === 0 && legacyItems.length > 0);
    const legacyIsRedundant =
      legacyItems.length === 0 || currentHistory === legacyHistory;

    if (currentCanBeReplaced) {
      mutations.push({ key: HISTORY_KEY, value: legacyHistory });
      mutations.push({ key: LEGACY_HISTORY_KEY, value: null });
    } else if (legacyIsRedundant) {
      mutations.push({ key: LEGACY_HISTORY_KEY, value: null });
    }
  }
  if (currentSchema !== targetSchema)
    mutations.push({ key: SCHEMA_KEY, value: targetSchema });

  if (mutations.length === 0) return false;
  executeStorageTransaction(mutations, storage);
  return true;
};
