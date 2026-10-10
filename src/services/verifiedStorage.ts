import { isRegisteredStorageKey } from "./storageKeyRegistry.ts";
import { assertStorageIsCurrent } from "./storageSynchronization.ts";
import type { StorageLike } from "./storageTransaction.ts";

const defaultStorage = (): StorageLike => {
  if (!("localStorage" in globalThis)) {
    throw new Error("この環境では端末内ストレージを利用できません。");
  }
  return globalThis.localStorage;
};

const assertWritableKey = (key: string): void => {
  if (!isRegisteredStorageKey(key)) {
    throw new Error(`保存対象外のキーです: ${key}`);
  }
};

/** 単一キーを保存し、ブラウザーから同じ値を読戻せることまで確認する。 */
export const writeStorageValue = (
  key: string,
  value: string,
  storage: StorageLike = defaultStorage(),
): void => {
  assertStorageIsCurrent();
  assertWritableKey(key);
  storage.setItem(key, value);
  if (storage.getItem(key) !== value) {
    throw new Error(`保存後の読戻し検証に失敗しました: ${key}`);
  }
};

/** 単一キーを削除し、削除済みであることまで確認する。 */
export const removeStorageValue = (
  key: string,
  storage: StorageLike = defaultStorage(),
): void => {
  assertStorageIsCurrent();
  assertWritableKey(key);
  storage.removeItem(key);
  if (storage.getItem(key) !== null) {
    throw new Error(`削除後の読戻し検証に失敗しました: ${key}`);
  }
};
