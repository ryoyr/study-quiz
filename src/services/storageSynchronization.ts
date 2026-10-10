import {
  isRegisteredStorageKey,
  STORAGE_KEYS,
  storageLabelForKey,
} from "./storageKeyRegistry.ts";

export interface ExternalStorageChange {
  key: string | null;
  label: string;
  detectedAt: string;
}

type Listener = (change: ExternalStorageChange) => void;

let latestExternalChange: ExternalStorageChange | null = null;
const listeners = new Set<Listener>();

/**
 * 複数タブで同じ端末データを同時編集した際、古いメモリ状態による上書きを防ぐ。
 * storageイベントは変更元タブでは発火しないため、自タブの通常保存は阻害しない。
 */
export const isRelevantExternalStorageKey = (key: string | null): boolean =>
  key === null ||
  (isRegisteredStorageKey(key) &&
    key !== STORAGE_KEYS.transactionJournal &&
    key !== STORAGE_KEYS.uiGuideSeen);

export const markExternalStorageChange = (
  key: string | null,
  detectedAt = new Date().toISOString(),
): ExternalStorageChange | null => {
  if (!isRelevantExternalStorageKey(key)) return null;
  const change: ExternalStorageChange = {
    key,
    label: key === null ? "端末内データ全体" : storageLabelForKey(key),
    detectedAt,
  };
  latestExternalChange = change;
  listeners.forEach((listener) => listener(change));
  return change;
};

export const getExternalStorageChange = (): ExternalStorageChange | null =>
  latestExternalChange;

export const assertStorageIsCurrent = (): void => {
  if (!latestExternalChange) return;
  throw new Error(
    `別のタブで${latestExternalChange.label}が変更されました。最新データを読み込んでから操作してください。`,
  );
};

export const subscribeExternalStorageChange = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** テストとページ再初期化専用。通常UIでは再読み込みにより状態を破棄する。 */
export const resetExternalStorageChange = (): void => {
  latestExternalChange = null;
};

