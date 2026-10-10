import { useEffect, useRef, useState } from "react";
import {
  getExternalStorageChange,
  markExternalStorageChange,
  subscribeExternalStorageChange,
  type ExternalStorageChange,
} from "../services/storageSynchronization";

export default function ConcurrentUpdateNotice() {
  const [change, setChange] = useState<ExternalStorageChange | null>(
    getExternalStorageChange,
  );
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const unsubscribe = subscribeExternalStorageChange(setChange);
    const handleStorage = (event: StorageEvent) => {
      if (event.storageArea && event.storageArea !== window.localStorage) return;
      markExternalStorageChange(event.key);
    };
    window.addEventListener("storage", handleStorage);
    return () => {
      unsubscribe();
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    if (!change) return;
    const frame = window.requestAnimationFrame(() => headingRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [change]);

  if (!change) return null;

  return (
    <aside
      className="concurrent-update-notice"
      role="alertdialog"
      aria-modal="false"
      aria-labelledby="concurrent-update-title"
      aria-describedby="concurrent-update-description"
    >
      <div>
        <p className="eyebrow">DATA UPDATED</p>
        <h2 id="concurrent-update-title" ref={headingRef} tabIndex={-1}>
          別のタブでデータが更新されました
        </h2>
        <p id="concurrent-update-description">
          {change.label}の古い状態を上書きしないよう、保存操作を停止しています。最新データを読み込んでください。
        </p>
      </div>
      <button
        className="primary-button compact-button"
        type="button"
        onClick={() => window.location.reload()}
      >
        最新データを読み込む
      </button>
    </aside>
  );
}
