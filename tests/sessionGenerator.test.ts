import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateRequiredNewCount } from '../src/services/studyPlanService.ts';
import type { Setup } from '../src/types/Setup.ts';

const setup: Setup = {
  name: 'LinuC 101',
  examDate: '2026-10-15',
  dailyNewLimit: 10,
  dailyQuestionLimit: 20,
  bufferRate: 20,
  instantThresholdSeconds: 30,
  dailyMinimumQuestions: 15,
  reservedDates: ['2026-10-06', '2026-10-07'],
  setupCompleted: true,
  createdAt: '2026-10-04T00:00:00.000Z',
  updatedAt: '2026-10-04T00:00:00.000Z',
};

test('予約日を除外し、バッファ率を加えた必要新規数を算出する', () => {
  const result = calculateRequiredNewCount(45, setup, new Date('2026-10-04T13:10:04.000Z'));
  assert.deepEqual(result, { effectiveDays: 9, requiredNewCount: 6 });
});

test('必要新規数は1日の新規上限を超えない', () => {
  const result = calculateRequiredNewCount(500, setup, new Date('2026-10-04T13:10:04.000Z'));
  assert.equal(result.requiredNewCount, 10);
});
