import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateStoragePressure,
  readStoragePersistenceStatus,
  requestPersistentStorage,
} from "../src/services/storagePersistenceService.ts";

test("保存容量の80%以上または残り5MB未満を容量逼迫と判定する", () => {
  const megabyte = 1024 * 1024;
  assert.equal(calculateStoragePressure(80 * megabyte, 100 * megabyte).lowSpace, true);
  assert.equal(calculateStoragePressure(50 * megabyte, 100 * megabyte).lowSpace, false);
  assert.equal(
    calculateStoragePressure(96 * 1024 * 1024, 100 * 1024 * 1024).lowSpace,
    true,
  );
  assert.deepEqual(calculateStoragePressure(null, null), {
    usageRatio: null,
    lowSpace: false,
  });
});

test("永続保存状態と容量を取得する", async () => {
  const status = await readStoragePersistenceStatus({
    estimate: async () => ({
      usage: 25 * 1024 * 1024,
      quota: 100 * 1024 * 1024,
    }),
    persisted: async () => true,
  });
  assert.equal(status.state, "persistent");
  assert.equal(status.usageRatio, 0.25);
  assert.equal(status.lowSpace, false);
});

test("利用者操作による永続保存要求後に状態を再確認する", async () => {
  let persisted = false;
  let requested = 0;
  const manager = {
    estimate: async () => ({ usage: 10, quota: 100 }),
    persisted: async () => persisted,
    persist: async () => {
      requested += 1;
      persisted = true;
      return true;
    },
  };
  const status = await requestPersistentStorage(manager);
  assert.equal(requested, 1);
  assert.equal(status.state, "persistent");
});

test("StorageManager非対応環境では安全にunsupportedを返す", async () => {
  const status = await readStoragePersistenceStatus(null);
  assert.equal(status.state, "unsupported");
  assert.equal(status.usage, null);
  assert.equal(status.quota, null);
});
