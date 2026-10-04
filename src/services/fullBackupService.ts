export type BackupStorageFormat = 'json' | 'number' | 'text';

export interface FullBackupFile {
  format: 'study-quiz-full-backup';
  version: 2 | 3 | 4;
  exportedAt: string;
  entries: Record<string, string>;
}

export interface BackupEntryDefinition {
  key: string;
  label: string;
  required: boolean;
  storageFormat: BackupStorageFormat;
}

export const BACKUP_ENTRIES: BackupEntryDefinition[] = [
  { key: 'study-quiz-setup-v1', label: '設定', required: false, storageFormat: 'json' },
  { key: 'study-quiz-questions-v1', label: '問題', required: false, storageFormat: 'json' },
  { key: 'study-quiz-answer-history-v1', label: '回答履歴', required: false, storageFormat: 'json' },
  { key: 'study-quiz-question-states-v1', label: '問題状態・FSRS', required: false, storageFormat: 'json' },
  { key: 'study-quiz-mistake-notes-v1', label: '間違いノート', required: false, storageFormat: 'json' },
  { key: 'study-quiz-question-annotations-v1', label: 'お気に入り・メモ', required: false, storageFormat: 'json' },
  { key: 'study-quiz-correction-suggestions-v1', label: '問題修正提案', required: false, storageFormat: 'json' },
  { key: 'study-quiz-ai-prompt-templates-v1', label: 'AI質問テンプレート', required: false, storageFormat: 'json' },
  { key: 'study-quiz-daily-time-budget-v1', label: '1日の学習時間上限', required: false, storageFormat: 'number' },
  { key: 'study-quiz-active-session-v1', label: '中断中の学習', required: false, storageFormat: 'json' },
  { key: 'study-quiz-gemini-model-v1', label: 'Geminiモデル設定', required: false, storageFormat: 'text' },
];

const LEGACY_HISTORY_KEY = 'study-quiz-history-v1';
const API_KEY = 'study-quiz-gemini-api-key-v1';
const definitionsByKey = new Map(BACKUP_ENTRIES.map((item) => [item.key, item]));
const supportedKeys = new Set([...definitionsByKey.keys(), LEGACY_HISTORY_KEY]);

const errorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error);

const validateStoredEntry = (definition: BackupEntryDefinition, value: string): void => {
  if (definition.storageFormat === 'json') {
    try { JSON.parse(value); }
    catch { throw new Error(`${definition.label}のJSONが不正です。`); }
    return;
  }
  if (definition.storageFormat === 'number') {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0 || number > 480) {
      throw new Error(`${definition.label}の値が不正です。`);
    }
    return;
  }
  if (value.length > 200 || /[\u0000-\u001F\u007F]/u.test(value)) {
    throw new Error(`${definition.label}の値が不正です。`);
  }
};

const normalizeExportedAt = (value: unknown): string => {
  if (value === undefined) return new Date().toISOString();
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new Error('バックアップの出力日時が不正です。');
  }
  return value;
};

export const createFullBackup = (): FullBackupFile => {
  const entries: Record<string, string> = {};
  BACKUP_ENTRIES.forEach(({ key }) => {
    const value = localStorage.getItem(key);
    if (value !== null) entries[key] = value;
  });
  return {
    format: 'study-quiz-full-backup',
    version: 4,
    exportedAt: new Date().toISOString(),
    entries,
  };
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

  if (
    value.format !== 'study-quiz-full-backup'
    || ![2, 3, 4].includes(value.version ?? 0)
    || typeof value.entries !== 'object'
    || value.entries === null
    || Array.isArray(value.entries)
  ) {
    throw new Error('対応していないバックアップ形式です。');
  }

  const entries = { ...value.entries };
  if (!entries['study-quiz-answer-history-v1'] && entries[LEGACY_HISTORY_KEY]) {
    entries['study-quiz-answer-history-v1'] = entries[LEGACY_HISTORY_KEY];
  }
  delete entries[LEGACY_HISTORY_KEY];
  delete entries[API_KEY];

  for (const [key, entry] of Object.entries(entries)) {
    if (!supportedKeys.has(key)) throw new Error(`未対応の保存領域が含まれています: ${key}`);
    if (typeof entry !== 'string') throw new Error(`${key} のデータ形式が不正です。`);
    const definition = definitionsByKey.get(key);
    if (definition) validateStoredEntry(definition, entry);
  }

  return {
    format: 'study-quiz-full-backup',
    version: 4,
    exportedAt: normalizeExportedAt(value.exportedAt),
    entries,
  };
};

export const restoreFullBackup = (backup: FullBackupFile): void => {
  const before = new Map<string, string | null>(
    BACKUP_ENTRIES.map(({ key }) => [key, localStorage.getItem(key)]),
  );

  try {
    BACKUP_ENTRIES.forEach(({ key }) => localStorage.removeItem(key));
    Object.entries(backup.entries).forEach(([key, value]) => {
      const definition = definitionsByKey.get(key);
      if (!definition) throw new Error(`未対応の保存領域です: ${key}`);
      validateStoredEntry(definition, value);
      localStorage.setItem(key, value);
    });
  } catch (restoreError) {
    try {
      BACKUP_ENTRIES.forEach(({ key }) => localStorage.removeItem(key));
      before.forEach((value, key) => {
        if (value !== null) localStorage.setItem(key, value);
      });
    } catch (rollbackError) {
      throw new Error(`復元とロールバックに失敗しました。復元: ${errorMessage(restoreError)} / ロールバック: ${errorMessage(rollbackError)}`);
    }
    throw new Error(`復元できなかったため元のデータへ戻しました。原因: ${errorMessage(restoreError)}`);
  }
};

export const inspectBackup = (backup: FullBackupFile) => BACKUP_ENTRIES.map((item) => ({
  label: item.label,
  included: Object.hasOwn(backup.entries, item.key),
  bytes: new Blob([backup.entries[item.key] ?? '']).size,
}));
