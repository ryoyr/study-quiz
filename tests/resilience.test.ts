import assert from 'node:assert/strict';
import test from 'node:test';
import { isActiveSessionSnapshot } from '../src/services/activeSessionStorage.ts';
import {
  createFullBackup,
  parseFullBackup,
  restoreFullBackup,
  type FullBackupFile,
} from '../src/services/fullBackupService.ts';

class MemoryStorage {
  private readonly values = new Map<string, string>();
  private failOnceKey = '';

  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) {
    if (key === this.failOnceKey) {
      this.failOnceKey = '';
      throw new Error('quota exceeded');
    }
    this.values.set(key, value);
  }
  failNextSetFor(key: string) { this.failOnceKey = key; }
}

const installStorage = () => {
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    configurable: true,
  });
  return storage;
};

test('完全バックアップは中断セッションとモデル設定を含みAPIキーを除外する', () => {
  const storage = installStorage();
  storage.setItem('study-quiz-active-session-v1', JSON.stringify({
    questionIds: ['Q-1'],
    currentIndex: 0,
    correctCount: 0,
    startedAt: '2026-10-05T00:00:00.000Z',
  }));
  storage.setItem('study-quiz-gemini-model-v1', 'gemini-2.5-flash');
  storage.setItem('study-quiz-gemini-api-key-v1', 'secret');

  const backup = createFullBackup();
  assert.equal(backup.version, 4);
  assert.ok(backup.entries['study-quiz-active-session-v1']);
  assert.equal(backup.entries['study-quiz-gemini-model-v1'], 'gemini-2.5-flash');
  assert.equal(backup.entries['study-quiz-gemini-api-key-v1'], undefined);
});

test('復元途中の保存失敗時は元のデータへロールバックする', () => {
  const storage = installStorage();
  storage.setItem('study-quiz-setup-v1', '{"name":"old"}');
  storage.setItem('study-quiz-questions-v1', '["old"]');
  storage.failNextSetFor('study-quiz-questions-v1');

  const backup: FullBackupFile = {
    format: 'study-quiz-full-backup',
    version: 4,
    exportedAt: '2026-10-05T00:00:00.000Z',
    entries: {
      'study-quiz-setup-v1': '{"name":"new"}',
      'study-quiz-questions-v1': '["new"]',
    },
  };

  assert.throws(() => restoreFullBackup(backup), /元のデータへ戻しました/);
  assert.equal(storage.getItem('study-quiz-setup-v1'), '{"name":"old"}');
  assert.equal(storage.getItem('study-quiz-questions-v1'), '["old"]');
});

test('旧形式をversion 4へ移行し、テキスト設定も検証できる', () => {
  const parsed = parseFullBackup(JSON.stringify({
    format: 'study-quiz-full-backup',
    version: 3,
    exportedAt: '2026-10-05T00:00:00.000Z',
    entries: {
      'study-quiz-history-v1': '[]',
      'study-quiz-gemini-model-v1': 'gemini-2.5-flash',
    },
  }));
  assert.equal(parsed.version, 4);
  assert.equal(parsed.entries['study-quiz-answer-history-v1'], '[]');
  assert.equal(parsed.entries['study-quiz-history-v1'], undefined);
});

test('中断セッションは範囲外位置・重複ID・不正日時を拒否する', () => {
  assert.equal(isActiveSessionSnapshot({
    questionIds: ['Q-1', 'Q-2'],
    currentIndex: 1,
    correctCount: 1,
    startedAt: '2026-10-05T00:00:00.000Z',
  }), true);
  assert.equal(isActiveSessionSnapshot({ questionIds: ['Q-1'], currentIndex: 1, correctCount: 0, startedAt: '2026-10-05T00:00:00.000Z' }), false);
  assert.equal(isActiveSessionSnapshot({ questionIds: ['Q-1', 'Q-1'], currentIndex: 0, correctCount: 0, startedAt: '2026-10-05T00:00:00.000Z' }), false);
  assert.equal(isActiveSessionSnapshot({ questionIds: ['Q-1'], currentIndex: 0, correctCount: 0, startedAt: 'invalid' }), false);
});
