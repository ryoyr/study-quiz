import { findSetup, persistSetup, removeSetup } from '../infrastructure/repositories/setupRepository';
import type { Setup } from '../types/Setup';

const LEGACY_STORAGE_KEY = 'study-quiz-setup-v1';

const normalizeLegacySetup = (value: Partial<Setup>): Setup => ({
  name: value.name ?? 'LinuC 101',
  examDate: value.examDate ?? '',
  dailyNewLimit: value.dailyNewLimit ?? 10,
  dailyQuestionLimit: value.dailyQuestionLimit ?? 20,
  bufferRate: value.bufferRate ?? 20,
  instantThresholdSeconds: value.instantThresholdSeconds ?? 30,
  dailyMinimumQuestions: value.dailyMinimumQuestions ?? 15,
  reservedDates: Array.isArray(value.reservedDates) ? value.reservedDates : [],
  setupCompleted: value.setupCompleted ?? false,
  createdAt: value.createdAt ?? new Date().toISOString(),
  updatedAt: value.updatedAt ?? new Date().toISOString(),
});

const loadLegacySetup = (): Setup | null => {
  try {
    const value = localStorage.getItem(LEGACY_STORAGE_KEY);
    return value ? normalizeLegacySetup(JSON.parse(value) as Partial<Setup>) : null;
  } catch {
    return null;
  }
};

const saveLegacyShadow = (setup: Setup): void => {
  try {
    // 既存バックアップとの互換用。正本はIndexedDBであり、失敗しても保存結果には影響させない。
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(setup));
  } catch {
    // Safariのプライベートモード等でlocalStorageが拒否されてもIndexedDBの保存を優先する。
  }
};

export const loadSetup = async (): Promise<Setup | null> => {
  const stored = await findSetup();
  if (stored) {
    saveLegacyShadow(stored);
    return stored;
  }

  const legacy = loadLegacySetup();
  if (!legacy) return null;
  await persistSetup(legacy);
  return legacy;
};

export const saveSetup = async (setup: Setup): Promise<void> => {
  await persistSetup(setup);
  saveLegacyShadow(setup);
};

export const clearSetup = async (): Promise<void> => {
  await removeSetup();
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // IndexedDBの削除は完了しているため、互換領域の失敗は無視する。
  }
};

export const getRemainingDays = (examDate: string): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exam = new Date(`${examDate}T00:00:00`);
  return Math.ceil((exam.getTime() - today.getTime()) / 86400000);
};
