import {
  executeStorageTransaction,
  type StorageLike,
} from "./storageTransaction.ts";
import { STORAGE_KEYS } from "./storageKeyRegistry.ts";

const LEGACY_HISTORY_KEY = STORAGE_KEYS.legacyHistory;
const HISTORY_KEY = STORAGE_KEYS.answerHistory;
const SCHEMA_KEY = STORAGE_KEYS.schemaVersion;
export const CURRENT_STORAGE_SCHEMA_VERSION = 6;

const defaultStorage = (): StorageLike => {
  if (!("localStorage" in globalThis)) {
    throw new Error("この環境では端末内ストレージを利用できません。");
  }
  return globalThis.localStorage;
};

const isJsonArray = (value: string): boolean => {
  try {
    return Array.isArray(JSON.parse(value));
  } catch {
    return false;
  }
};

/** 旧キーを現行キーへ一度だけ移行し、移行途中の失敗時は元へ戻す。 */
export const migrateLegacyStorage = (
  storage: StorageLike = defaultStorage(),
): boolean => {
  const legacyHistory = storage.getItem(LEGACY_HISTORY_KEY);
  const currentHistory = storage.getItem(HISTORY_KEY);
  const currentSchema = storage.getItem(SCHEMA_KEY);
  const targetSchema = String(CURRENT_STORAGE_SCHEMA_VERSION);

  const mutations = [] as Array<{ key: string; value: string | null }>;
  if (!currentHistory && legacyHistory && isJsonArray(legacyHistory)) {
    mutations.push({ key: HISTORY_KEY, value: legacyHistory });
  }
  if (legacyHistory !== null)
    mutations.push({ key: LEGACY_HISTORY_KEY, value: null });
  if (currentSchema !== targetSchema)
    mutations.push({ key: SCHEMA_KEY, value: targetSchema });

  if (mutations.length === 0) return false;
  executeStorageTransaction(mutations, storage);
  return true;
};
