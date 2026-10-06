import assert from "node:assert/strict";
import test from "node:test";
import {
  loadQuestions,
  saveQuestions,
} from "../src/services/questionStorage.ts";
import type { Question } from "../src/types/Question.ts";

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

const question: Question = {
  id: "Q-1",
  examScopeId: "lpic101",
  category: "Linux",
  text: "test",
  choices: ["A", "B"],
  answerIndex: 0,
  explanation: "explanation",
  weight: 1,
  difficulty: 1,
};

test("アーカイブ日時を含む問題を保存・再読込できる", () => {
  installStorage();
  const archived = { ...question, archivedAt: "2026-10-05T00:00:00.000Z" };
  saveQuestions([archived]);
  assert.deepEqual(loadQuestions(), [archived]);
});

test("重複IDまたは不正な選択肢は保存しない", () => {
  installStorage();
  assert.throws(() => saveQuestions([question, { ...question }]), /重複/);
  assert.throws(
    () => saveQuestions([{ ...question, choices: ["A"], answerIndex: 0 }]),
    /形式/,
  );
});

