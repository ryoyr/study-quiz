import { useEffect, useRef, useState } from "react";
import {
  removeSetup,
  persistSetup,
} from "../infrastructure/repositories/setupRepository";
import {
  BACKUP_ENTRIES,
  auditStorage,
  compareFullBackup,
  createFullBackup,
  downloadBackupFile,
  downloadFullBackup,
  inspectBackup,
  parseFullBackup,
  restoreFullBackup,
  type FullBackupFile,
  type BackupComparisonReport,
  type BackupChangeKind,
  type StorageAuditReport,
} from "../services/fullBackupService";
import { STORAGE_KEYS } from "../services/storageKeyRegistry";
import {
  readStoragePersistenceStatus,
  requestPersistentStorage,
  type StoragePersistenceStatus,
} from "../services/storagePersistenceService";
import type { Setup } from "../types/Setup";

type Props = { onBack: () => void };
const SETUP_KEY = STORAGE_KEYS.setup;
const MAX_BACKUP_BYTES = 25 * 1024 * 1024;
const changeLabels: Record<BackupChangeKind, string> = {
  added: "追加",
  removed: "削除",
  changed: "置換",
  unchanged: "変更なし",
};

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
  const [comparison, setComparison] = useState<BackupComparisonReport | null>(null);
  const [restoreAcknowledged, setRestoreAcknowledged] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [auditing, setAuditing] = useState(false);
  const [audit, setAudit] = useState<StorageAuditReport | null>(null);
  const [persistence, setPersistence] =
    useState<StoragePersistenceStatus | null>(null);
  const [persisting, setPersisting] = useState(false);

  const refreshAudit = async () => {
    setAuditing(true);
    await Promise.resolve();
    const nextAudit = auditStorage();
    setAudit(nextAudit);
    try {
      setPersistence(await readStoragePersistenceStatus());
    } catch {
      setPersistence(null);
    } finally {
      setAuditing(false);
    }
  };

  const persistStorage = async () => {
    if (persisting) return;
    setPersisting(true);
    setError("");
    setMessage("");
    try {
      const next = await requestPersistentStorage();
      setPersistence(next);
      setMessage(
        next.state === "persistent"
          ? "この端末のデータを優先的に保持する設定を確認できました。"
          : "ブラウザーは永続保存を許可しませんでした。定期的に完全バックアップを出力してください。",
      );
    } catch (persistError) {
      setError(
        persistError instanceof Error
          ? persistError.message
          : "端末データの保持状態を更新できませんでした。",
      );
    } finally {
      setPersisting(false);
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
      const nextComparison = compareFullBackup(parsed);
      setPreview(parsed);
      setComparison(nextComparison);
      setRestoreAcknowledged(false);
      window.requestAnimationFrame(() => previewHeadingRef.current?.focus());
    } catch (loadError) {
      setPreview(null);
      setComparison(null);
      setRestoreAcknowledged(false);
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
    if (!preview || !comparison || !restoreAcknowledged || restoring) return;

    setRestoring(true);
    setError("");
    let before: FullBackupFile;
    try {
      before = createFullBackup();
      downloadBackupFile(before, "study-quiz-pre-restore");
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
      setMessage("復元しました。復元前バックアップも保存済みです。最新データを読み込みます。");
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
              {persistence?.usage !== null && persistence?.usage !== undefined && (
                <span>
                  ブラウザー使用量 <strong>{formatBytes(persistence.usage)}</strong>
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

        <section
          className={`storage-persistence-card ${persistence?.state === "persistent" ? "is-persistent" : ""} ${persistence?.lowSpace ? "has-issue" : ""}`}
          aria-labelledby="storage-persistence-heading"
          aria-busy={persisting}
        >
          <div>
            <h2 id="storage-persistence-heading">端末データの保持</h2>
            <p>
              {persistence?.state === "persistent"
                ? "ブラウザーによる自動削除を受けにくい永続保存が有効です。"
                : persistence?.state === "best-effort"
                  ? "現在は通常保存です。空き容量不足時に削除される可能性があります。"
                  : "このブラウザーでは永続保存の状態を確認できません。"}
            </p>
          </div>
          <div className="storage-persistence-summary">
            <span className="storage-health-badge" role="status" aria-live="polite">
              {persisting
                ? "確認中"
                : persistence?.state === "persistent"
                  ? "永続保存"
                  : persistence?.state === "best-effort"
                    ? "通常保存"
                    : "非対応"}
            </span>
            {persistence?.usage !== null &&
              persistence?.usage !== undefined &&
              persistence.quota !== null && (
                <span className="storage-capacity-label">
                  {formatBytes(persistence.usage)} / {formatBytes(persistence.quota)}
                  {persistence.usageRatio !== null
                    ? `（${Math.round(persistence.usageRatio * 100)}%）`
                    : ""}
                </span>
              )}
          </div>
          {persistence?.lowSpace && (
            <p className="storage-capacity-warning" role="alert">
              保存領域の空きが少なくなっています。完全バックアップを出力し、不要なサイトデータを整理してください。
            </p>
          )}
          {persistence?.state === "best-effort" && (
            <button
              className="secondary-button compact-button"
              type="button"
              disabled={persisting || restoring}
              onClick={() => void persistStorage()}
            >
              {persisting ? "確認中..." : "端末データの保持を強化"}
            </button>
          )}
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
            {comparison ? (
              <>
                <div className="backup-diff-summary" aria-label="現在データとの差分集計">
                  <span><strong>{comparison.addedCount}</strong> 追加</span>
                  <span><strong>{comparison.changedCount}</strong> 置換</span>
                  <span><strong>{comparison.removedCount}</strong> 削除</span>
                  <span><strong>{comparison.unchangedCount}</strong> 変更なし</span>
                </div>
                <div className="backup-preview-list backup-diff-list" role="list" aria-label="保存領域ごとの差分">
                  {comparison.entries.map((item) => (
                    <div key={item.key} role="listitem" className={`backup-diff-row is-${item.change}`}>
                      <span>
                        {item.label}
                        <small>
                          現在 {item.currentIncluded ? formatBytes(item.currentBytes) : "なし"}
                          {item.currentItemCount !== null ? `・${item.currentItemCount}件` : ""}
                          {" → "}
                          復元後 {item.incomingIncluded ? formatBytes(item.incomingBytes) : "なし"}
                          {item.incomingItemCount !== null ? `・${item.incomingItemCount}件` : ""}
                        </small>
                      </span>
                      <strong className={`backup-change-badge is-${item.change}`}>
                        {changeLabels[item.change]}
                      </strong>
                    </div>
                  ))}
                </div>
                <div className="backup-restore-confirmation">
                  <label>
                    <input
                      type="checkbox"
                      checked={restoreAcknowledged}
                      onChange={(event) => setRestoreAcknowledged(event.target.checked)}
                    />
                    <span>
                      現在のデータが上記の内容で置き換わることを確認しました。
                      実行直前に現在の完全バックアップを自動保存します。
                    </span>
                  </label>
                  {comparison.destructiveCount > 0 && (
                    <p className="backup-destructive-note" role="status">
                      {comparison.destructiveCount}領域で現在値の置換または削除が発生します。
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="backup-preview-list">
                {inspectBackup(preview).map((item) => (
                  <div key={item.label}>
                    <span>{item.label}</span>
                    <strong>{item.included ? formatBytes(item.bytes) : "含まれない"}</strong>
                  </div>
                ))}
              </div>
            )}
            <button
              className="backup-danger-button"
              type="button"
              disabled={restoring || !restoreAcknowledged || !comparison}
              aria-describedby="backup-restore-help"
              onClick={() => void restore()}
            >
              {restoring ? "復元中..." : "確認した内容で復元"}
            </button>
            <p id="backup-restore-help" className="backup-restore-help">
              復元は全対象領域を置き換えます。チェックを入れるまで実行できません。
            </p>
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
