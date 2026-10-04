


import type { Setup } from '../types/Setup';
import type { StudyHistory } from '../types/StudyHistory';
import { validateSetup } from './setupValidation';
import type { QuestionState } from '../types/QuestionState';

export interface StudyQuizBackup {
  schemaVersion: 3;
  appVersion: string;
  exportedAt: string;
  data: { setup: Setup; answerHistories: StudyHistory[]; questionStates: QuestionState[]; };
}

export interface RestoreResult { setup: Setup; history: StudyHistory[]; questionStates: QuestionState[]; }

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const isHistory = (value: unknown): value is StudyHistory => {
  if (!isObject(value)) return false;
  return typeof value.id === 'string' && typeof value.questionId === 'string' && typeof value.category === 'string' &&
    typeof value.selectedIndex === 'number' && typeof value.correct === 'boolean' && typeof value.answeredAt === 'string' &&
    typeof value.responseTimeSeconds === 'number' && Number.isFinite(value.responseTimeSeconds) && value.responseTimeSeconds >= 0 &&
    typeof value.instantScore === 'number' && Number.isFinite(value.instantScore) && value.instantScore >= 0 && value.instantScore <= 1;
};

export const createBackup = (setup: Setup, history: StudyHistory[], questionStates: QuestionState[]): StudyQuizBackup => ({
  schemaVersion: 3,
  appVersion: '1.0.0',
  exportedAt: new Date().toISOString(),
  data: { setup, answerHistories: history, questionStates },
});

export const downloadBackup = (setup: Setup, history: StudyHistory[], questionStates: QuestionState[]): void => {
  const backup = createBackup(setup, history, questionStates);
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const stamp = backup.exportedAt.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  anchor.href = url;
  anchor.download = `study-quiz-backup-${stamp}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

export const restoreBackupText = (text: string): RestoreResult => {
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error('JSONファイルを読み取れません。'); }
  if (!isObject(parsed) || parsed.schemaVersion !== 3 || !isObject(parsed.data)) {
    throw new Error('対応していないバックアップ形式です。');
  }
  const setup = parsed.data.setup;
  const answerHistories = parsed.data.answerHistories;
  const questionStates = parsed.data.questionStates;
  if (!isObject(setup) || !Array.isArray(answerHistories) || !Array.isArray(questionStates)) throw new Error('バックアップの必須データが不足しています。');
  const restoredSetup = setup as unknown as Setup;
  if (Object.keys(validateSetup(restoredSetup)).length > 0) throw new Error('バックアップ内の設定値が不正です。');
  if (!answerHistories.every(isHistory)) throw new Error('バックアップ内の回答履歴が不正です。');
  return { setup: restoredSetup, history: answerHistories, questionStates: questionStates as QuestionState[] };
};
