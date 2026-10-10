import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  appendQuestionRevision,
  changedQuestionFields,
  createQuestionRevision,
  isQuestionRevision,
  loadQuestionRevisions,
  saveQuestionRevisions,
} from "../src/services/questionRevisionService.ts";
import type { Question } from "../src/types/Question.ts";

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

const base: Question = {
  id: "Q-1",
  examScopeId: "scope",
  category: "Linux",
  text: "question",
  choices: ["A", "B"],
  answerIndex: 0,
  explanation: "段落1\n\n- 項目A\n- 項目B",
  weight: 1,
  difficulty: 1,
};

test("問題改訂履歴は問題IDを維持して変更フィールドと前後を保存する", () => {
  const after = { ...base, explanation: "更新後", difficulty: 2 };
  const revision = createQuestionRevision({
    before: base,
    after,
    source: "manual",
    summary: "解説と難易度を更新",
    createdAt: "2026-10-11T00:00:00.000Z",
  });
  assert.equal(isQuestionRevision(revision), true);
  assert.deepEqual(changedQuestionFields(base, after), ["explanation", "difficulty"]);
  assert.deepEqual(revision.changedFields, ["explanation", "difficulty"]);
  assert.equal(revision.before?.id, revision.after.id);
});

test("問題改訂履歴は登録済み保存キーで往復する", () => {
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
  const revision = createQuestionRevision({
    before: base,
    after: { ...base, text: "updated" },
    source: "quality-proposal",
    summary: "品質提案を適用",
  });
  saveQuestionRevisions(appendQuestionRevision([], revision));
  assert.deepEqual(loadQuestionRevisions(), [revision]);
});

test("改行・段落・箇条書きはHTML挿入せずReact要素として表示する", () => {
  const source = readFileSync("src/components/StructuredText.tsx", "utf8");
  assert.match(source, /split\("\\n"\)/u);
  assert.match(source, /kind: "list"/u);
  assert.match(source, /<ul/u);
  assert.match(source, /<li/u);
  assert.match(source, /<br \/>/u);
  assert.doesNotMatch(source, /dangerouslySetInnerHTML/u);
});

test("問題編集は保存前プレビューと改訂履歴を表示する", () => {
  const source = readFileSync("src/pages/QuestionManagementPage.tsx", "utf8");
  assert.match(source, /保存前プレビュー/u);
  assert.match(source, /改訂履歴/u);
  assert.match(source, /createQuestionRevision/u);
  assert.match(source, /StructuredText/u);
});


test("問題改訂履歴はストレージレジストリと完全バックアップ検証へ登録する", () => {
  const registry = readFileSync("src/services/storageKeyRegistry.ts", "utf8");
  const backup = readFileSync("src/services/fullBackupService.ts", "utf8");
  assert.match(registry, /study-quiz-question-revisions-v1/u);
  assert.match(registry, /questionRevisions/u);
  assert.match(backup, /case STORAGE_KEYS\.questionRevisions/u);
  assert.match(backup, /isQuestionRevision/u);
  assert.match(backup, /STORAGE_KEYS\.questionRevisions/u);
});
