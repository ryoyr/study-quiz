import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { BACKUP_ENTRIES } from "../src/services/fullBackupService.ts";
import {
  isRegisteredStorageKey,
  STORAGE_KEY_REGISTRY,
  STORAGE_KEYS,
} from "../src/services/storageKeyRegistry.ts";

const listSourceFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(directory, entry.name);
    if (entry.isDirectory()) return listSourceFiles(child);
    return /\.tsx?$/.test(entry.name) ? [child] : [];
  });

test("Storage Key Registryの物理キーは一意でアプリ接頭辞を持つ", () => {
  const definitions = Object.values(STORAGE_KEY_REGISTRY);
  const keys = definitions.map(({ key }) => key);

  assert.equal(new Set(keys).size, keys.length);
  assert.equal(keys.every((key) => key.startsWith("study-quiz-")), true);
  assert.equal(keys.every(isRegisteredStorageKey), true);
  assert.equal(
    isRegisteredStorageKey(STORAGE_KEYS.transactionJournal),
    true,
  );
  assert.equal(isRegisteredStorageKey("study-quiz-unknown-v1"), false);
});

test("バックアップ対象はRegistryの定義と一致し、内部・廃止キーを含まない", () => {
  const expected = Object.values(STORAGE_KEY_REGISTRY)
    .filter(({ backup }) => backup)
    .map(({ key }) => key);

  assert.deepEqual(
    BACKUP_ENTRIES.map(({ key }) => key),
    expected,
  );
  assert.equal(expected.includes(STORAGE_KEYS.transactionJournal), false);
  assert.equal(expected.includes(STORAGE_KEYS.geminiApiKey), false);
  assert.equal(expected.includes(STORAGE_KEYS.geminiModel), false);
});

test("物理ストレージキーをRegistry以外の実装へ直書きしない", () => {
  const registryPath = path.normalize("src/services/storageKeyRegistry.ts");
  const source = listSourceFiles("src")
    .filter((file) => path.normalize(file) !== registryPath)
    .map((file) => `${file}\n${readFileSync(file, "utf8")}`)
    .join("\n");

  for (const { key } of Object.values(STORAGE_KEY_REGISTRY)) {
    assert.equal(source.includes(`"${key}"`), false, `${key} が直書きされています`);
  }
});

