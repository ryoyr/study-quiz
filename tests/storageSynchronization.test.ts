import assert from "node:assert/strict";
import test from "node:test";
import { STORAGE_KEYS } from "../src/services/storageKeyRegistry.ts";
import {
  assertStorageIsCurrent,
  getExternalStorageChange,
  isRelevantExternalStorageKey,
  markExternalStorageChange,
  resetExternalStorageChange,
} from "../src/services/storageSynchronization.ts";
import {
  removeStorageValue,
  writeStorageValue,
} from "../src/services/verifiedStorage.ts";
import type { StorageLike } from "../src/services/storageTransaction.ts";

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>();
  ignoreWrites = false;
  ignoreRemovals = false;
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (!this.ignoreWrites) this.values.set(key, value);
  }
  removeItem(key: string) {
    if (!this.ignoreRemovals) this.values.delete(key);
  }
}

test("別タブの登録済みデータ変更を検知し、以後の上書きを拒否する", () => {
  resetExternalStorageChange();
  const change = markExternalStorageChange(
    STORAGE_KEYS.answerHistory,
    "2026-10-06T00:00:00.000Z",
  );
  assert.equal(change?.label, "回答履歴");
  assert.equal(getExternalStorageChange()?.key, STORAGE_KEYS.answerHistory);
  assert.throws(() => assertStorageIsCurrent(), /別のタブ/);

  const storage = new MemoryStorage();
  assert.throws(
    () => writeStorageValue(STORAGE_KEYS.answerHistory, "[]", storage),
    /最新データを読み込んで/,
  );
  resetExternalStorageChange();
});

test("UIガイドと未登録キーの変更は学習データ競合として扱わない", () => {
  resetExternalStorageChange();
  assert.equal(isRelevantExternalStorageKey(STORAGE_KEYS.uiGuideSeen), false);
  assert.equal(isRelevantExternalStorageKey("other-app"), false);
  assert.equal(markExternalStorageChange("other-app"), null);
  assert.doesNotThrow(() => assertStorageIsCurrent());
});

test("localStorage全消去は競合として扱う", () => {
  resetExternalStorageChange();
  assert.equal(markExternalStorageChange(null)?.label, "端末内データ全体");
  assert.throws(() => assertStorageIsCurrent(), /端末内データ全体/);
  resetExternalStorageChange();
});

test("単一キー保存と削除は読戻し不一致を検出する", () => {
  resetExternalStorageChange();
  const storage = new MemoryStorage();
  storage.ignoreWrites = true;
  assert.throws(
    () => writeStorageValue(STORAGE_KEYS.answerHistory, "[]", storage),
    /読戻し検証/,
  );

  storage.ignoreWrites = false;
  writeStorageValue(STORAGE_KEYS.answerHistory, "[]", storage);
  storage.ignoreRemovals = true;
  assert.throws(
    () => removeStorageValue(STORAGE_KEYS.answerHistory, storage),
    /削除後の読戻し検証/,
  );
});

