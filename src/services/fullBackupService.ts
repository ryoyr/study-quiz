export interface FullBackupFile {
  format: 'study-quiz-full-backup';
  version: 2 | 3;
  exportedAt: string;
  entries: Record<string, string>;
}

export interface BackupEntryDefinition {
  key: string;
  label: string;
  required: boolean;
}

export const BACKUP_ENTRIES: BackupEntryDefinition[] = [
  { key: 'study-quiz-setup-v1', label: '設定', required: false },
  { key: 'study-quiz-questions-v1', label: '問題', required: false },
  { key: 'study-quiz-answer-history-v1', label: '回答履歴', required: false },
  { key: 'study-quiz-question-states-v1', label: '問題状態・FSRS', required: false },
  { key: 'study-quiz-mistake-notes-v1', label: '間違いノート', required: false },
  { key: 'study-quiz-question-annotations-v1', label: 'お気に入り・メモ', required: false },
  { key: 'study-quiz-correction-suggestions-v1', label: '問題修正提案', required: false },
  { key: 'study-quiz-ai-prompt-templates-v1', label: 'AI質問テンプレート', required: false },
  { key: 'study-quiz-daily-time-budget-v1', label: '1日の学習時間上限', required: false },
];

const LEGACY_HISTORY_KEY = 'study-quiz-history-v1';
const supportedKeys = new Set([...BACKUP_ENTRIES.map((item) => item.key), LEGACY_HISTORY_KEY]);

export const createFullBackup = (): FullBackupFile => {
  const entries: Record<string, string> = {};
  BACKUP_ENTRIES.forEach(({ key }) => {
    const value = localStorage.getItem(key);
    if (value !== null) entries[key] = value;
  });
  return { format: 'study-quiz-full-backup', version: 3, exportedAt: new Date().toISOString(), entries };
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
  let value: Partial<FullBackupFile>;
  try { value = JSON.parse(text) as Partial<FullBackupFile>; }
  catch { throw new Error('JSONファイルを読み取れません。'); }
  if (value.format !== 'study-quiz-full-backup' || ![2, 3].includes(value.version ?? 0) || typeof value.entries !== 'object' || value.entries === null) {
    throw new Error('対応していないバックアップ形式です。');
  }
  const entries = { ...value.entries };
  if (!entries['study-quiz-answer-history-v1'] && entries[LEGACY_HISTORY_KEY]) {
    entries['study-quiz-answer-history-v1'] = entries[LEGACY_HISTORY_KEY];
  }
  delete entries[LEGACY_HISTORY_KEY];
  for (const [key, entry] of Object.entries(entries)) {
    if (!supportedKeys.has(key)) throw new Error(`未対応の保存領域が含まれています: ${key}`);
    if (typeof entry !== 'string') throw new Error(`${key} のデータ形式が不正です。`);
    try { JSON.parse(entry); }
    catch { throw new Error(`${key} のJSONが不正です。`); }
  }
  return { format: 'study-quiz-full-backup', version: 3, exportedAt: value.exportedAt ?? new Date().toISOString(), entries };
};

export const restoreFullBackup = (backup: FullBackupFile): void => {
  BACKUP_ENTRIES.forEach(({ key }) => localStorage.removeItem(key));
  Object.entries(backup.entries).forEach(([key, value]) => localStorage.setItem(key, value));
};

export const inspectBackup = (backup: FullBackupFile) => BACKUP_ENTRIES.map((item) => ({
  label: item.label,
  included: Object.hasOwn(backup.entries, item.key),
  bytes: new Blob([backup.entries[item.key] ?? '']).size,
}));
