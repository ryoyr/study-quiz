import { useEffect, useRef, useState } from "react";
import {
  removeSetup,
  persistSetup,
} from "../infrastructure/repositories/setupRepository";
import {
  BACKUP_ENTRIES,
  auditStorage,
  createFullBackup,
  downloadFullBackup,
  inspectBackup,
  parseFullBackup,
  restoreFullBackup,
  type FullBackupFile,
  type StorageAuditReport,
} from "../services/fullBackupService";
import { STORAGE_KEYS } from "../services/storageKeyRegistry";
import type { Setup } from "../types/Setup";

type Props = { onBack: () => void };
const SETUP_KEY = STORAGE_KEYS.setup;
const MAX_BACKUP_BYTES = 25 * 1024 * 1024;

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes.toLocaleString()} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const setupFromBackup = (backup: FullBackupFile): Setup | null => {
  const json = backup.entries[SETUP_KEY];
  return json ? (JSON.parse(json) as Setup) : null;
};

const synchronizeIndexedSetup = async (
  backup: FullBackupFile,
): Promise<void> => {
  const setup = setupFromBackup(backup);
  if (setup) await persistSetup(setup);
  else await removeSetup();
};

export default function BackupCenterPage({ onBack }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewHeadingRef = useRef<HTMLHeadingElement>(null);
  const [preview, setPreview] = useState<FullBackupFile | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [auditing, setAuditing] = useState(false);
  const [audit, setAudit] = useState<StorageAuditReport | null>(null);
  const [storageEstimate, setStorageEstimate] = useState<{
    usage: number;
    quota: number;
  } | null>(null);

  const refreshAudit = async () => {
    setAuditing(true);
    await Promise.resolve();
    const nextAudit = auditStorage();
    setAudit(nextAudit);
    try {
      const estimate = await navigator.storage?.estimate?.();
      if (
        typeof estimate?.usage === "number" &&
        typeof estimate.quota === "number"
      ) {
        setStorageEstimate({ usage: estimate.usage, quota: estimate.quota });
      }
    } catch {
      setStorageEstimate(null);
    } finally {
      setAuditing(false);
    }
  };

  useEffect(() => {
    void refreshAudit();
  }, []);

  const load = async (file: File) => {
    setError("");
    setMessage("");
    try {
      if (file.size > MAX_BACKUP_BYTES) {
        throw new Error(
          "バックアップは25MB以下のJSONファイルを指定してください。",
        );
      }
      const parsed = parseFullBackup(await file.text());
      setPreview(parsed);
      window.requestAnimationFrame(() => previewHeadingRef.current?.focus());
    } catch (loadError) {
      setPreview(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "バックアップの確認に失敗しました。",
      );
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const restore = async () => {
    if (!preview || restoring) return;
    if (
      !window.confirm(
        "現在の対象データを削除し、バックアップ内容で置き換えます。実行しますか？",
      )
    ) {
      return;
    }

    setRestoring(true);
    setError("");
    let before: FullBackupFile;
    try {
      before = createFullBackup();
    } catch (backupError) {
      setError(
        backupError instanceof Error
          ? backupError.message
          : "復元前データを退避できませんでした。",
      );
      setRestoring(false);
      return;
    }

    try {
      restoreFullBackup(preview);
      await synchronizeIndexedSetup(preview);
      setMessage("復元しました。最新データを読み込みます。");
      window.setTimeout(() => window.location.reload(), 500);
    } catch (restoreError) {
      try {
        restoreFullBackup(before);
        await synchronizeIndexedSetup(before);
      } catch (rollbackError) {
        const restoreReason =
          restoreError instanceof Error ? restoreError.message : "不明なエラー";
        const rollbackReason =
          rollbackError instanceof Error
            ? rollbackError.message
            : "不明なエラー";
        setError(
          `復元とロールバックに失敗しました。復元: ${restoreReason} / ロールバック: ${rollbackReason}`,
        );
        setRestoring(false);
        return;
      }
      setError(
        restoreError instanceof Error
          ? restoreError.message
          : "復元に失敗したため元のデータへ戻しました。",
      );
      setRestoring(false);
    }
  };

  const integrityLabel = preview
    ? preview.sourceVersion === 9
      ? "整合性チェック済み"
      : `旧形式v${preview.sourceVersion ?? preview.version}を現行形式へ変換済み`
    : "";

  return (
    <main className="app-shell">
      <section className="home-card backup-center-card">
        <p className="eyebrow">DATA SAFETY</p>
        <h1>完全バックアップ</h1>
        <p className="planning-note" id="backup-description">
          設定、問題、学習履歴、FSRS、ノート、修正提案、中断中の学習を1ファイルへ保存します。
          秘密情報は出力しません。復元前に形式・値・参照関係・整合性を検証します。
        </p>

        <section
          className={`storage-health-card ${audit?.ok ? "is-healthy" : audit ? "has-issue" : ""}`}
          aria-labelledby="storage-health-heading"
          aria-busy={auditing}
        >
          <div className="storage-health-heading">
            <div>
              <h2 id="storage-health-heading">端末内データの健全性</h2>
              <p>
                {auditing
                  ? "保存データを検査しています。"
                  : audit?.ok
                    ? "形式・参照関係・バックアップ変換を確認できました。"
                    : audit
                      ? "修復または退避が必要なデータを検出しました。"
                      : "未検査です。"}
              </p>
            </div>
            <span className="storage-health-badge" role="status" aria-live="polite">
              {auditing ? "検査中" : audit?.ok ? "正常" : audit ? "要確認" : "未検査"}
            </span>
          </div>
          {audit && (
            <div className="storage-health-summary">
              <span>保存領域 <strong>{audit.includedCount}/{BACKUP_ENTRIES.length}</strong></span>
              <span>対象データ <strong>{formatBytes(audit.totalBytes)}</strong></span>
              {storageEstimate && storageEstimate.quota > 0 && (
                <span>
                  ブラウザー使用量 <strong>{formatBytes(storageEstimate.usage)}</strong>
                </span>
              )}
            </div>
          )}
          {audit && !audit.ok && (
            <ul className="storage-health-issues">
              {audit.issues.map((issue) => <li key={issue}>{issue}</li>)}
            </ul>
          )}
          <button
            className="secondary-button compact-button"
            type="button"
            disabled={auditing || restoring}
            onClick={() => void refreshAudit()}
          >
            {auditing ? "検査中..." : "もう一度検査"}
          </button>
        </section>

        <div className="backup-primary-actions">
          <button
            className="primary-button"
            type="button"
            disabled={restoring || auditing || audit?.ok === false}
            aria-describedby="backup-description"
            onClick={() => {
              try {
                downloadFullBackup();
                setError("");
                setMessage("整合性情報付きの完全バックアップを出力しました。");
              } catch (downloadError) {
                setMessage("");
                setError(
                  downloadError instanceof Error
                    ? downloadError.message
                    : "バックアップを出力できませんでした。",
                );
              }
            }}
          >
            完全バックアップを出力
          </button>
          <input
            ref={fileInputRef}
            className="file-input"
            type="file"
            aria-label="復元するバックアップJSON"
            accept="application/json,.json"
            disabled={restoring}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void load(file);
            }}
          />
          <button
            className="restore-button"
            type="button"
            disabled={restoring}
            onClick={() => fileInputRef.current?.click()}
          >
            復元ファイルを選択
          </button>
        </div>

        <div
          className="backup-drop-zone"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const file = event.dataTransfer.files?.[0];
            if (file && !restoring) void load(file);
          }}
        >
          JSONファイルはここへドロップすることもできます（最大25MB）。
        </div>

        <details className="backup-target-details">
          <summary>バックアップ対象 {BACKUP_ENTRIES.length}領域を確認</summary>
          <div className="backup-targets" aria-label="バックアップ対象">
            {BACKUP_ENTRIES.map((item) => (
              <span key={item.key}>{item.label}</span>
            ))}
          </div>
        </details>

        {preview && (
          <section className="backup-preview" aria-label="復元内容の確認">
            <h2 ref={previewHeadingRef} tabIndex={-1}>復元内容の確認</h2>
            <p>
              元の形式: v{preview.sourceVersion ?? preview.version} / アプリ: {preview.appVersion} /
              出力日時: {new Date(preview.exportedAt).toLocaleString("ja-JP")}
            </p>
            <p className="backup-integrity-status">✓ {integrityLabel}</p>
            <div className="backup-preview-list">
              {inspectBackup(preview).map((item) => (
                <div key={item.label}>
                  <span>{item.label}</span>
                  <strong>
                    {item.included ? formatBytes(item.bytes) : "含まれない"}
                  </strong>
                </div>
              ))}
            </div>
            <button
              className="backup-danger-button"
              type="button"
              disabled={restoring}
              onClick={() => void restore()}
            >
              {restoring ? "復元中..." : "確認した内容で復元"}
            </button>
          </section>
        )}
        {message && (
          <div className="backup-success" role="status" aria-live="polite">
            {message}
          </div>
        )}
        {error && (
          <div className="error-box" role="alert">
            {error}
          </div>
        )}
        <button
          className="secondary-button"
          type="button"
          disabled={restoring}
          onClick={onBack}
        >
          前のメニューへ戻る
        </button>
      </section>
    </main>
  );
}
