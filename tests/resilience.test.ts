import assert from "node:assert/strict";
import test from "node:test";
import {
  isActiveSessionSnapshot,
  reconcileActiveSessionSnapshot,
} from "../src/services/activeSessionStorage.ts";
import {
  createFullBackup,
  parseFullBackup,
  restoreFullBackup,
  type FullBackupFile,
} from "../src/services/fullBackupService.ts";
import { migrateLegacyStorage } from "../src/services/storageMigration.ts";
import type { Question } from "../src/types/Question.ts";

class MemoryStorage {
  private readonly values = new Map<string, string>();
  private failOnceKey = "";

  get length() {
    return this.values.size;
  }
  clear() {
    this.values.clear();
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  setItem(key: string, value: string) {
    if (key === this.failOnceKey) {
      this.failOnceKey = "";
      throw new Error("quota exceeded");
    }
    this.values.set(key, value);
  }
  failNextSetFor(key: string) {
    this.failOnceKey = key;
  }
}

const installStorage = () => {
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
  });
  return storage;
};

test("完全バックアップは中断セッションを含み廃止済みAI設定とAPIキーを除外する", () => {
  const storage = installStorage();
  storage.setItem(
    "study-quiz-active-session-v1",
    JSON.stringify({
      questionIds: ["Q-1"],
      currentIndex: 0,
      correctCount: 0,
      startedAt: "2026-10-05T00:00:00.000Z",
    }),
  );
  storage.setItem("study-quiz-gemini-model-v1", "gemini-2.5-flash");
  storage.setItem("study-quiz-gemini-api-key-v1", "secret");

  const backup = createFullBackup();
  assert.equal(backup.version, 7);
  assert.ok(backup.entries["study-quiz-active-session-v1"]);
  assert.equal(backup.entries["study-quiz-gemini-model-v1"], undefined);
  assert.equal(backup.entries["study-quiz-gemini-api-key-v1"], undefined);
});

test("復元途中の保存失敗時は元のデータへロールバックする", () => {
  const storage = installStorage();
  storage.setItem("study-quiz-schema-version", "4");
  storage.setItem("study-quiz-daily-time-budget-v1", "15");
  storage.failNextSetFor("study-quiz-daily-time-budget-v1");

  const backup: FullBackupFile = {
    format: "study-quiz-full-backup",
    version: 4,
    appVersion: "0.2.0",
    exportedAt: "2026-10-05T00:00:00.000Z",
    entries: {
      "study-quiz-schema-version": "5",
      "study-quiz-daily-time-budget-v1": "30",
    },
  };

  assert.throws(() => restoreFullBackup(backup), /変更前へ戻しました/);
  assert.equal(storage.getItem("study-quiz-schema-version"), "4");
  assert.equal(storage.getItem("study-quiz-daily-time-budget-v1"), "15");
});

test("旧形式をversion 7へ移行し、廃止済み設定を除外する", () => {
  const parsed = parseFullBackup(
    JSON.stringify({
      format: "study-quiz-full-backup",
      version: 3,
      exportedAt: "2026-10-05T00:00:00.000Z",
      entries: {
        "study-quiz-history-v1": "[]",
        "study-quiz-gemini-model-v1": "gemini-2.5-flash",
      },
    }),
  );
  assert.equal(parsed.version, 7);
  assert.equal(parsed.entries["study-quiz-answer-history-v1"], "[]");
  assert.equal(parsed.entries["study-quiz-history-v1"], undefined);
  assert.equal(parsed.entries["study-quiz-gemini-model-v1"], undefined);
});

test("端末内の旧履歴キーを現行キーへ移行する", () => {
  const storage = new MemoryStorage();
  storage.setItem("study-quiz-history-v1", '[{"id":"legacy"}]');

  assert.equal(migrateLegacyStorage(storage), true);
  assert.equal(
    storage.getItem("study-quiz-answer-history-v1"),
    '[{"id":"legacy"}]',
  );
  assert.equal(storage.getItem("study-quiz-history-v1"), null);
  assert.equal(storage.getItem("study-quiz-schema-version"), "7");
  assert.equal(migrateLegacyStorage(storage), false);
});

test("中断セッションは範囲外位置・重複ID・不正日時を拒否する", () => {
  assert.equal(
    isActiveSessionSnapshot({
      questionIds: ["Q-1", "Q-2"],
      currentIndex: 1,
      correctCount: 1,
      startedAt: "2026-10-05T00:00:00.000Z",
    }),
    true,
  );
  assert.equal(
    isActiveSessionSnapshot({
      questionIds: ["Q-1"],
      currentIndex: 1,
      correctCount: 0,
      startedAt: "2026-10-05T00:00:00.000Z",
    }),
    false,
  );
  assert.equal(
    isActiveSessionSnapshot({
      questionIds: ["Q-1", "Q-1"],
      currentIndex: 0,
      correctCount: 0,
      startedAt: "2026-10-05T00:00:00.000Z",
    }),
    false,
  );
  assert.equal(
    isActiveSessionSnapshot({
      questionIds: ["Q-1"],
      currentIndex: 0,
      correctCount: 0,
      startedAt: "invalid",
    }),
    false,
  );
});

test("中断後に問題が削除されても未回答の先頭から安全に再開する", () => {
  const question = (id: string): Question => ({
    id,
    examScopeId: "lpic101",
    category: "101.1",
    text: id,
    choices: ["A", "B"],
    answerIndex: 0,
    explanation: "",
    weight: 1,
    difficulty: 1,
  });
  const reconciled = reconcileActiveSessionSnapshot(
    {
      questionIds: ["Q-1", "Q-2", "Q-3"],
      currentIndex: 1,
      correctCount: 1,
      startedAt: "2026-10-05T00:00:00.000Z",
    },
    [question("Q-2"), question("Q-3")],
  );

  assert.ok(reconciled);
  assert.deepEqual(reconciled.snapshot.questionIds, ["Q-2", "Q-3"]);
  assert.equal(reconciled.snapshot.currentIndex, 0);
  assert.equal(reconciled.snapshot.correctCount, 0);
  assert.deepEqual(reconciled.questions.map((item) => item.id), ["Q-2", "Q-3"]);
  assert.equal(reconciled.changed, true);
});

test("中断セッションの未回答問題がすべて削除済みなら再開しない", () => {
  const reconciled = reconcileActiveSessionSnapshot(
    {
      questionIds: ["Q-1", "Q-2"],
      currentIndex: 1,
      correctCount: 1,
      startedAt: "2026-10-05T00:00:00.000Z",
    },
    [],
  );
  assert.equal(reconciled, null);
});

