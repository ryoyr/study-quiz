export type PersistenceState = "persistent" | "best-effort" | "unsupported";

export interface StoragePersistenceStatus {
  state: PersistenceState;
  usage: number | null;
  quota: number | null;
  usageRatio: number | null;
  lowSpace: boolean;
}

interface StorageManagerLike {
  estimate?: () => Promise<{ usage?: number; quota?: number }>;
  persisted?: () => Promise<boolean>;
  persist?: () => Promise<boolean>;
}

const validBytes = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

export const calculateStoragePressure = (
  usage: number | null,
  quota: number | null,
): Pick<StoragePersistenceStatus, "usageRatio" | "lowSpace"> => {
  if (usage === null || quota === null || quota <= 0) {
    return { usageRatio: null, lowSpace: false };
  }
  const usageRatio = Math.min(1, Math.max(0, usage / quota));
  const remaining = Math.max(0, quota - usage);
  return {
    usageRatio,
    lowSpace: usageRatio >= 0.8 || remaining < 5 * 1024 * 1024,
  };
};

const currentStorageManager = (): StorageManagerLike | null => {
  if (typeof navigator === "undefined" || !("storage" in navigator)) return null;
  return navigator.storage;
};

export const readStoragePersistenceStatus = async (
  manager: StorageManagerLike | null = currentStorageManager(),
): Promise<StoragePersistenceStatus> => {
  if (!manager) {
    return {
      state: "unsupported",
      usage: null,
      quota: null,
      usageRatio: null,
      lowSpace: false,
    };
  }

  let usage: number | null = null;
  let quota: number | null = null;
  try {
    const estimate = await manager.estimate?.();
    usage = validBytes(estimate?.usage) ? estimate.usage : null;
    quota = validBytes(estimate?.quota) ? estimate.quota : null;
  } catch {
    // 容量推定に失敗しても永続化状態の確認は続行する。
  }

  let state: PersistenceState = "unsupported";
  if (typeof manager.persisted === "function") {
    try {
      state = (await manager.persisted()) ? "persistent" : "best-effort";
    } catch {
      state = "best-effort";
    }
  }

  return { state, usage, quota, ...calculateStoragePressure(usage, quota) };
};

/** 利用者の明示操作からのみ呼び出し、ブラウザーへ永続保存を要求する。 */
export const requestPersistentStorage = async (
  manager: StorageManagerLike | null = currentStorageManager(),
): Promise<StoragePersistenceStatus> => {
  if (!manager || typeof manager.persist !== "function") {
    return readStoragePersistenceStatus(manager);
  }
  try {
    await manager.persist();
  } catch {
    // ブラウザーの拒否・非対応は状態として画面へ返す。
  }
  return readStoragePersistenceStatus(manager);
};

