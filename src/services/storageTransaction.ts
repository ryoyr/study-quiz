import {
  isRegisteredStorageKey,
  STORAGE_KEYS,
} from "./storageKeyRegistry.ts";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface StorageMutation {
  key: string;
  value: string | null;
}

interface StorageTransactionJournal {
  version: 1;
  createdAt: string;
  before: Record<string, string | null>;
}

const JOURNAL_KEY = STORAGE_KEYS.transactionJournal;

const getDefaultStorage = (): StorageLike => {
  if (!("localStorage" in globalThis)) {
    throw new Error("この環境では端末内ストレージを利用できません。");
  }
  return globalThis.localStorage;
};

const isAppDataKey = (key: string): boolean =>
  isRegisteredStorageKey(key) && key !== JOURNAL_KEY;

const validateMutations = (mutations: StorageMutation[]): StorageMutation[] => {
  if (mutations.length === 0) return [];
  const seen = new Set<string>();
  return mutations.map((mutation) => {
    if (!isAppDataKey(mutation.key)) {
      throw new Error(`保存対象外のキーです: ${mutation.key}`);
    }
    if (seen.has(mutation.key)) {
      throw new Error(`保存対象のキーが重複しています: ${mutation.key}`);
    }
    if (mutation.value !== null && typeof mutation.value !== "string") {
      throw new Error(`保存値の形式が不正です: ${mutation.key}`);
    }
    seen.add(mutation.key);
    return mutation;
  });
};

const parseJournal = (raw: string): StorageTransactionJournal | null => {
  try {
    const value = JSON.parse(raw) as Partial<StorageTransactionJournal>;
    if (
      value.version !== 1 ||
      typeof value.createdAt !== "string" ||
      !Number.isFinite(Date.parse(value.createdAt)) ||
      !value.before ||
      typeof value.before !== "object" ||
      Array.isArray(value.before)
    )
      return null;

    for (const [key, previous] of Object.entries(value.before)) {
      if (
        !isAppDataKey(key) ||
        (previous !== null && typeof previous !== "string")
      )
        return null;
    }
    return value as StorageTransactionJournal;
  } catch {
    return null;
  }
};

const applyValues = (
  storage: StorageLike,
  values: Record<string, string | null>,
): void => {
  Object.entries(values).forEach(([key, value]) => {
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, value);
  });
};

/**
 * 前回の保存がブラウザ終了などで中断していた場合、変更前の状態へ戻す。
 * 復旧できたときだけtrueを返す。
 */
export const recoverStorageTransaction = (
  storage: StorageLike = getDefaultStorage(),
): boolean => {
  const raw = storage.getItem(JOURNAL_KEY);
  if (!raw) return false;

  const journal = parseJournal(raw);
  if (!journal) {
    storage.removeItem(JOURNAL_KEY);
    return false;
  }

  applyValues(storage, journal.before);
  storage.removeItem(JOURNAL_KEY);
  return true;
};

/**
 * 複数のlocalStorage更新をジャーナル付きで実行する。
 * 途中で失敗した場合は全キーを変更前へ戻し、次回起動時にも未完了処理を復旧できる。
 */
export const executeStorageTransaction = (
  mutations: StorageMutation[],
  storage: StorageLike = getDefaultStorage(),
): void => {
  const targets = validateMutations(mutations);
  if (targets.length === 0) return;

  // 既存の未完了処理を先に解消し、ジャーナルを上書きしない。
  recoverStorageTransaction(storage);

  const before = Object.fromEntries(
    targets.map(({ key }) => [key, storage.getItem(key)]),
  );
  const journal: StorageTransactionJournal = {
    version: 1,
    createdAt: new Date().toISOString(),
    before,
  };
  storage.setItem(JOURNAL_KEY, JSON.stringify(journal));

  try {
    targets.forEach(({ key, value }) => {
      if (value === null) storage.removeItem(key);
      else storage.setItem(key, value);
    });
    storage.removeItem(JOURNAL_KEY);
  } catch (writeError) {
    try {
      applyValues(storage, before);
      storage.removeItem(JOURNAL_KEY);
    } catch (rollbackError) {
      const writeReason =
        writeError instanceof Error ? writeError.message : String(writeError);
      const rollbackReason =
        rollbackError instanceof Error
          ? rollbackError.message
          : String(rollbackError);
      throw new Error(
        `保存と復旧に失敗しました。保存: ${writeReason} / 復旧: ${rollbackReason}`,
      );
    }
    const reason =
      writeError instanceof Error ? writeError.message : String(writeError);
    throw new Error(`保存できなかったため変更前へ戻しました。原因: ${reason}`);
  }
};

export const STORAGE_TRANSACTION_JOURNAL_KEY = JOURNAL_KEY;
