import assert from 'node:assert/strict';
import test from 'node:test';
import { loadHistory } from '../src/services/historyStorage.ts';

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const installStorage = () => {
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    configurable: true,
  });
  return storage;
};

test('再読込後もFSRS評価を学習履歴に保持する', () => {
  const storage = installStorage();
  storage.setItem('study-quiz-answer-history-v1', JSON.stringify([{
    id: 'H-1',
    questionId: 'Q-1',
    category: 'Linux',
    selectedIndex: 0,
    correct: true,
    answeredAt: '2026-10-05T00:00:00.000Z',
    responseTimeSeconds: 5,
    instantScore: 0.8,
    fsrsRating: 'GOOD',
  }]));

  assert.equal(loadHistory()[0]?.fsrsRating, 'GOOD');
});

test('不正なFSRS評価は履歴へ取り込まない', () => {
  const storage = installStorage();
  storage.setItem('study-quiz-answer-history-v1', JSON.stringify([{
    id: 'H-1',
    questionId: 'Q-1',
    category: 'Linux',
    selectedIndex: 0,
    correct: true,
    answeredAt: '2026-10-05T00:00:00.000Z',
    responseTimeSeconds: 5,
    instantScore: 0.8,
    fsrsRating: 'INVALID',
  }]));

  assert.equal(loadHistory()[0]?.fsrsRating, undefined);
});
