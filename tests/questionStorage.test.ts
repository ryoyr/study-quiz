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

test("複数選択・入力回答の問題を保存して再読込できる", () => {
  installStorage();
  const multiple: Question = {
    ...question,
    id: "M-1",
    questionType: "multiple",
    choices: ["A", "B", "C"],
    answerIndex: 0,
    answerIndices: [0, 2],
  };
  const text: Question = {
    ...question,
    id: "T-1",
    questionType: "text",
    choices: [],
    answerIndex: 0,
    acceptedAnswers: ["LVM"],
  };
  saveQuestions([multiple, text]);
  assert.deepEqual(loadQuestions(), [multiple, text]);
});

test("複数選択の重複正解と入力回答の空許容回答を拒否する", () => {
  installStorage();
  assert.throws(
    () => saveQuestions([{ ...question, questionType: "multiple", answerIndices: [0, 0] }]),
    /形式/,
  );
  assert.throws(
    () => saveQuestions([{ ...question, questionType: "text", choices: [], acceptedAnswers: [] }]),
    /形式/,
  );
});
