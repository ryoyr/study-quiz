import assert from "node:assert/strict";
import test from "node:test";
import { loadHistory } from "../src/services/historyStorage.ts";

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
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

test("再読込後もFSRS評価を学習履歴に保持する", () => {
  const storage = installStorage();
  storage.setItem(
    "study-quiz-answer-history-v1",
    JSON.stringify([
      {
        id: "H-1",
        questionId: "Q-1",
        category: "Linux",
        selectedIndex: 0,
        correct: true,
        answeredAt: "2026-10-05T00:00:00.000Z",
        responseTimeSeconds: 5,
        instantScore: 0.8,
        fsrsRating: "GOOD",
      },
    ]),
  );

  assert.equal(loadHistory()[0]?.fsrsRating, "GOOD");
});

test("不正なFSRS評価は履歴へ取り込まない", () => {
  const storage = installStorage();
  storage.setItem(
    "study-quiz-answer-history-v1",
    JSON.stringify([
      {
        id: "H-1",
        questionId: "Q-1",
        category: "Linux",
        selectedIndex: 0,
        correct: true,
        answeredAt: "2026-10-05T00:00:00.000Z",
        responseTimeSeconds: 5,
        instantScore: 0.8,
        fsrsRating: "INVALID",
      },
    ]),
  );

  assert.equal(loadHistory()[0]?.fsrsRating, undefined);
});

test("回答時点の問題方式と方式別回答を再読込できる", () => {
  const storage = installStorage();
  storage.setItem(
    "study-quiz-answer-history-v1",
    JSON.stringify([
      {
        id: "H-M",
        questionId: "Q-M",
        category: "Linux",
        selectedIndex: -1,
        selectedIndices: [2, 0, 2],
        answerType: "multiple",
        correct: true,
        answeredAt: "2026-10-05T00:00:00.000Z",
        responseTimeSeconds: 5,
        instantScore: 0.8,
      },
      {
        id: "H-T",
        questionId: "Q-T",
        category: "Linux",
        selectedIndex: -1,
        textAnswer: "LVM",
        answerType: "text",
        correct: true,
        answeredAt: "2026-10-05T00:01:00.000Z",
        responseTimeSeconds: 6,
        instantScore: 0.7,
      },
    ]),
  );

  const history = loadHistory();
  assert.deepEqual(history[0]?.selectedIndices, [2, 0]);
  assert.equal(history[0]?.answerType, "multiple");
  assert.equal(history[1]?.textAnswer, "LVM");
  assert.equal(history[1]?.answerType, "text");
});

test("有効な回答時点スナップショットを保持し、不正なものだけ除外する", () => {
  const storage = installStorage();
  const base = {
    id: "H-S",
    questionId: "Q-S",
    category: "Linux",
    selectedIndex: 0,
    answerType: "single",
    correct: true,
    answeredAt: "2026-10-11T00:00:00.000Z",
    responseTimeSeconds: 5,
    instantScore: 0.8,
  };
  storage.setItem(
    "study-quiz-answer-history-v1",
    JSON.stringify([
      {
        ...base,
        questionSnapshot: {
          questionText: "回答時点の問題",
          answerType: "single",
          responseText: "選択肢1: A",
          correctAnswerText: "選択肢1: A",
        },
      },
      {
        ...base,
        id: "H-invalid",
        questionSnapshot: {
          questionText: "",
          answerType: "single",
          responseText: "A",
          correctAnswerText: "A",
        },
      },
    ]),
  );

  const history = loadHistory();
  assert.equal(history[0].questionSnapshot?.questionText, "回答時点の問題");
  assert.equal(history[1].questionSnapshot, undefined);
});
