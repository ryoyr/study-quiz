import assert from "node:assert/strict";
import test from "node:test";
import { saveLearningProgress } from "../src/services/learningProgressStorage.ts";
import { STORAGE_KEYS } from "../src/services/storageKeyRegistry.ts";
import {
  executeStorageTransaction,
  recoverStorageTransaction,
  STORAGE_TRANSACTION_JOURNAL_KEY,
  type StorageLike,
} from "../src/services/storageTransaction.ts";
import type { QuestionState } from "../src/types/QuestionState.ts";
import type { StudyHistory } from "../src/types/StudyHistory.ts";

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>();
  private failOnceKey = "";

  getItem(key: string) {
    return this.values.get(key) ?? null;
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

const history: StudyHistory[] = [
  {
    id: "H-1",
    questionId: "Q-1",
    category: "Linux",
    selectedIndex: 0,
    correct: true,
    answeredAt: "2026-10-05T00:00:00.000Z",
    responseTimeSeconds: 4.2,
    instantScore: 0.86,
    fsrsRating: "GOOD",
  },
];

const states: QuestionState[] = [
  {
    questionId: "Q-1",
    correctCount: 1,
    incorrectCount: 0,
    totalCount: 1,
    averageResponseTimeSeconds: 4.2,
    recentResponseTimeSeconds: 4.2,
    averageInstantScore: 0.86,
    recentInstantScore: 0.86,
    recentIncorrect: false,
    lastAnsweredAt: "2026-10-05T00:00:00.000Z",
    masteryLevel: "LEARNING",
    fsrsCard: null,
    nextReviewAt: null,
    fsrsStability: 0,
    fsrsDifficulty: 0,
  },
];

test("回答履歴・問題状態・中断位置をまとめて保存する", () => {
  const storage = new MemoryStorage();
  saveLearningProgress(
    {
      history,
      questionStates: states,
      activeSession: {
        questionIds: ["Q-1", "Q-2"],
        currentIndex: 1,
        correctCount: 1,
        startedAt: "2026-10-05T00:00:00.000Z",
      },
    },
    storage,
  );

  assert.deepEqual(
    JSON.parse(storage.getItem("study-quiz-answer-history-v1") ?? "[]"),
    history,
  );
  assert.deepEqual(
    JSON.parse(storage.getItem("study-quiz-question-states-v1") ?? "[]"),
    states,
  );
  assert.equal(storage.getItem(STORAGE_TRANSACTION_JOURNAL_KEY), null);
});

test("途中の書込み失敗では関連データをすべて変更前へ戻す", () => {
  const storage = new MemoryStorage();
  storage.setItem("study-quiz-answer-history-v1", '["old-history"]');
  storage.setItem("study-quiz-question-states-v1", '["old-state"]');
  storage.setItem("study-quiz-active-session-v1", '{"old":true}');
  storage.failNextSetFor("study-quiz-question-states-v1");

  assert.throws(
    () =>
      saveLearningProgress(
        { history, questionStates: states, activeSession: null },
        storage,
      ),
    /変更前へ戻しました/,
  );
  assert.equal(
    storage.getItem("study-quiz-answer-history-v1"),
    '["old-history"]',
  );
  assert.equal(
    storage.getItem("study-quiz-question-states-v1"),
    '["old-state"]',
  );
  assert.equal(storage.getItem("study-quiz-active-session-v1"), '{"old":true}');
  assert.equal(storage.getItem(STORAGE_TRANSACTION_JOURNAL_KEY), null);
});

test("前回中断したトランザクションを次回起動時に復旧する", () => {
  const storage = new MemoryStorage();
  storage.setItem("study-quiz-answer-history-v1", '["partial-new"]');
  storage.setItem(
    STORAGE_TRANSACTION_JOURNAL_KEY,
    JSON.stringify({
      version: 1,
      createdAt: "2026-10-05T00:00:00.000Z",
      before: {
        "study-quiz-answer-history-v1": '["old"]',
        "study-quiz-question-states-v1": null,
      },
    }),
  );

  assert.equal(recoverStorageTransaction(storage), true);
  assert.equal(storage.getItem("study-quiz-answer-history-v1"), '["old"]');
  assert.equal(storage.getItem("study-quiz-question-states-v1"), null);
  assert.equal(storage.getItem(STORAGE_TRANSACTION_JOURNAL_KEY), null);
});

test("アプリ外キーと重複キーはトランザクション対象にしない", () => {
  const storage = new MemoryStorage();
  assert.throws(
    () =>
      executeStorageTransaction(
        [{ key: "other-app-key", value: "x" }],
        storage,
      ),
    /保存対象外/,
  );
  assert.throws(
    () =>
      executeStorageTransaction(
        [
          { key: STORAGE_KEYS.answerHistory, value: "1" },
          { key: STORAGE_KEYS.answerHistory, value: "2" },
        ],
        storage,
      ),
    /重複/,
  );
});
