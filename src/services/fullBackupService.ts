import { clearSetup, saveSetup } from './setupStorage';
import { validateSetup } from './setupValidation';
import type { Setup } from '../types/Setup';

export interface FullBackupFile {
  format: 'study-quiz-full-backup';
  version: 2;
  exportedAt: string;
  entries: Record<string, string>;
}
export interface BackupEntryDefinition { key: string; label: string; required: boolean; }

const SETUP_STORAGE_KEY = 'study-quiz-setup-v1';

export const BACKUP_ENTRIES: BackupEntryDefinition[] = [
  { key: SETUP_STORAGE_KEY, label: '設定', required: false },
  { key: 'study-quiz-questions-v1', label: '問題', required: false },
  { key: 'study-quiz-history-v1', label: '回答履歴', required: false },
  { key: 'study-quiz-question-states-v1', label: '問題状態・FSRS', required: false },
  { key: 'study-quiz-mistake-notes-v1', label: '間違いノート', required: false },
  { key: 'study-quiz-question-annotations-v1', label: 'お気に入り・メモ', required: false },
  { key: 'study-quiz-correction-suggestions-v1', label: '問題修正提案', required: false },
  { key: 'study-quiz-ai-prompt-templates-v1', label: 'AI質問テンプレート', required: false },
  { key: 'study-quiz-daily-time-budget-v1', label: '1日の学習時間上限', required: false },
];

export const createFullBackup = (): FullBackupFile => {
  const entries: Record<string, string> = {};
  BACKUP_ENTRIES.forEach(({ key }) => {
    const value = localStorage.getItem(key);
    if (value !== null) entries[key] = value;
  });
  return { format: 'study-quiz-full-backup', version: 2, exportedAt: new Date().toISOString(), entries };
};

export const downloadFullBackup = (): void => {
  const backup = createFullBackup();
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const stamp = backup.exportedAt.replace(/[:.]/g, '-');
  anchor.href = url;
  anchor.download = `study-quiz-full-backup-${stamp}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

export const parseFullBackup = (text: string): FullBackupFile => {
  const value = JSON.parse(text) as Partial<FullBackupFile>;
  if (value.format !== 'study-quiz-full-backup' || value.version !== 2 || typeof value.entries !== 'object' || value.entries === null) {
    throw new Error('対応していないバックアップ形式です。');
  }
  for (const [key, entry] of Object.entries(value.entries)) {
    if (!BACKUP_ENTRIES.some((item) => item.key === key)) throw new Error(`未対応の保存領域が含まれています: ${key}`);
    if (typeof entry !== 'string') throw new Error(`${key} のデータ形式が不正です。`);
    JSON.parse(entry);
  }
  return value as FullBackupFile;
};

export const restoreFullBackup = async (backup: FullBackupFile): Promise<void> => {
  const setupText = backup.entries[SETUP_STORAGE_KEY];
  if (setupText) {
    const setup = JSON.parse(setupText) as Setup;
    if (Object.keys(validateSetup(setup)).length > 0) {
      throw new Error('バックアップ内の設定値が不正です。');
    }
    await saveSetup(setup);
  } else {
    await clearSetup();
  }

  BACKUP_ENTRIES.filter(({ key }) => key !== SETUP_STORAGE_KEY)
    .forEach(({ key }) => localStorage.removeItem(key));
  Object.entries(backup.entries)
    .filter(([key]) => key !== SETUP_STORAGE_KEY)
    .forEach(([key, value]) => localStorage.setItem(key, value));
};

export const inspectBackup = (backup: FullBackupFile) => BACKUP_ENTRIES.map((item) => ({
  label: item.label,
  included: Object.hasOwn(backup.entries, item.key),
  bytes: new Blob([backup.entries[item.key] ?? '']).size,
}));
