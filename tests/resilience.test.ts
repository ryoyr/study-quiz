import assert from "node:assert/strict";
import test from "node:test";
import {
  isActiveSessionSnapshot,
  reconcileActiveSessionSnapshot,
} from "../src/services/activeSessionStorage.ts";
import {
  auditStorage,
  compareFullBackup,
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
  assert.equal(backup.version, 9);
  assert.equal(backup.integrity?.algorithm, "FNV-1A-32");
  assert.ok(backup.entries["study-quiz-active-session-v1"]);
  assert.equal(backup.entries["study-quiz-gemini-model-v1"], undefined);
  assert.equal(backup.entries["study-quiz-gemini-api-key-v1"], undefined);
});

test("現行ストレージ版8を含むバックアップを出力後に再検証できる", () => {
  const storage = installStorage();
  storage.setItem("study-quiz-schema-version", "8");
  storage.setItem("study-quiz-answer-history-v1", "[]");

  const backup = createFullBackup(storage);
  const parsed = parseFullBackup(JSON.stringify(backup));

  assert.equal(parsed.version, 9);
  assert.equal(parsed.sourceVersion, 9);
  assert.equal(parsed.entries["study-quiz-schema-version"], "8");
});

test("復元前比較は追加・削除・置換・変更なしを保存領域単位で集計する", () => {
  const current = new MemoryStorage();
  current.setItem("study-quiz-schema-version", "8");
  current.setItem("study-quiz-answer-history-v1", "[]");
  current.setItem("study-quiz-daily-time-budget-v1", "15");

  const incomingStorage = new MemoryStorage();
  incomingStorage.setItem("study-quiz-schema-version", "8");
  incomingStorage.setItem("study-quiz-questions-v1", "[]");
  incomingStorage.setItem("study-quiz-daily-time-budget-v1", "30");
  const report = compareFullBackup(createFullBackup(incomingStorage), current);

  assert.equal(report.addedCount, 1);
  assert.equal(report.removedCount, 1);
  assert.equal(report.changedCount, 1);
  assert.equal(report.destructiveCount, 2);
  assert.equal(
    report.entries.find((item) => item.key === "study-quiz-questions-v1")?.incomingItemCount,
    0,
  );
  assert.equal(
    report.entries.find((item) => item.key === "study-quiz-schema-version")?.change,
    "unchanged",
  );
});

test("復元前比較は破損した現在データを差分として扱わない", () => {
  const current = new MemoryStorage();
  current.setItem("study-quiz-answer-history-v1", "not-json");
  const incoming = new MemoryStorage();
  incoming.setItem("study-quiz-schema-version", "8");

  assert.throws(
    () => compareFullBackup(createFullBackup(incoming), current),
    /JSON/,
  );
});

test("整合性情報付きバックアップの出力後改変を拒否する", () => {
  const storage = installStorage();
  storage.setItem("study-quiz-schema-version", "8");
  const backup = createFullBackup(storage);
  const tampered = structuredClone(backup);
  tampered.entries["study-quiz-schema-version"] = "7";

  assert.throws(
    () => parseFullBackup(JSON.stringify(tampered)),
    /変更または破損/,
  );
});

test("端末内データ診断は正常データと破損JSONを識別する", () => {
  const storage = installStorage();
  storage.setItem("study-quiz-schema-version", "8");
  storage.setItem("study-quiz-answer-history-v1", "[]");
  assert.equal(auditStorage(storage).ok, true);

  storage.setItem("study-quiz-answer-history-v1", "not-json");
  const report = auditStorage(storage);
  assert.equal(report.ok, false);
  assert.match(report.issues[0], /JSON/);
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

test("旧形式をversion 9へ移行し、廃止済み設定を除外する", () => {
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
  assert.equal(parsed.version, 9);
  assert.equal(parsed.sourceVersion, 3);
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
  assert.equal(storage.getItem("study-quiz-schema-version"), "8");
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



test("未完了トランザクションが残る間は不整合なバックアップを出力しない", () => {
  const storage = installStorage();
  storage.setItem(
    "study-quiz-storage-transaction-v1",
    JSON.stringify({
      version: 1,
      createdAt: "2026-10-06T00:00:00.000Z",
      before: { "study-quiz-answer-history-v1": "[]" },
    }),
  );
  assert.throws(() => createFullBackup(storage), /未完了の保存処理/);
  assert.equal(auditStorage(storage).ok, false);
});
