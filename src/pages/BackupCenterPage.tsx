import { useRef, useState } from 'react';
import {
  BACKUP_ENTRIES,
  createFullBackup,
  downloadFullBackup,
  inspectBackup,
  parseFullBackup,
  restoreFullBackup,
  type FullBackupFile,
} from '../services/fullBackupService';
import { persistSetup } from '../infrastructure/repositories/setupRepository';
import type { Setup } from '../types/Setup';

type Props = { onBack: () => void };
const SETUP_KEY = 'study-quiz-setup-v1';

const setupFromBackup = (backup: FullBackupFile): Setup | null => {
  const json = backup.entries[SETUP_KEY];
  return json ? JSON.parse(json) as Setup : null;
};

export default function BackupCenterPage({ onBack }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<FullBackupFile | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [restoring, setRestoring] = useState(false);

  const load = async (file: File) => {
    setError('');
    setMessage('');
    try {
      setPreview(parseFullBackup(await file.text()));
    } catch (loadError) {
      setPreview(null);
      setError(loadError instanceof Error ? loadError.message : 'バックアップの確認に失敗しました。');
    } finally {
      if (ref.current) ref.current.value = '';
    }
  };

  const restore = async () => {
    if (!preview || restoring) return;
    if (!window.confirm('現在の対象データを削除し、バックアップ内容で置き換えます。実行しますか？')) return;

    setRestoring(true);
    setError('');
    const before = createFullBackup();

    try {
      restoreFullBackup(preview);
      const restoredSetup = setupFromBackup(preview);
      if (restoredSetup) await persistSetup(restoredSetup);
      setMessage('復元しました。最新データを読み込みます。');
      window.setTimeout(() => window.location.reload(), 800);
    } catch (restoreError) {
      try {
        restoreFullBackup(before);
        const previousSetup = setupFromBackup(before);
        if (previousSetup) await persistSetup(previousSetup);
      } catch (rollbackError) {
        const restoreReason = restoreError instanceof Error ? restoreError.message : '不明なエラー';
        const rollbackReason = rollbackError instanceof Error ? rollbackError.message : '不明なエラー';
        setError(`復元とロールバックに失敗しました。復元: ${restoreReason} / ロールバック: ${rollbackReason}`);
        setRestoring(false);
        return;
      }
      setError(restoreError instanceof Error ? restoreError.message : '復元に失敗したため元のデータへ戻しました。');
      setRestoring(false);
    }
  };

  return (
    <main className="app-shell">
      <section className="home-card backup-center-card">
        <h1>完全バックアップ</h1>
        <p className="planning-note">
          設定、問題、学習履歴、FSRS、ノート、修正提案、中断中の学習を1ファイルへ保存します。
          APIキーは安全のため出力しません。
        </p>
        <button
          className="primary-button"
          type="button"
          onClick={() => {
            downloadFullBackup();
            setMessage('完全バックアップを出力しました。');
          }}
        >
          完全バックアップを出力
        </button>
        <input
          ref={ref}
          className="file-input"
          type="file"
          accept="application/json,.json"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void load(file);
          }}
        />
        <button className="restore-button" type="button" onClick={() => ref.current?.click()}>
          復元ファイルを選択
        </button>
        <div className="backup-targets">
          {BACKUP_ENTRIES.map((item) => <span key={item.key}>{item.label}</span>)}
        </div>
        {preview && (
          <section className="backup-preview">
            <h2>復元内容の確認</h2>
            <p>形式: v{preview.version} / 出力日時: {new Date(preview.exportedAt).toLocaleString('ja-JP')}</p>
            {inspectBackup(preview).map((item) => (
              <div key={item.label}>
                <span>{item.label}</span>
                <strong>{item.included ? `${item.bytes.toLocaleString()} bytes` : '含まれない'}</strong>
              </div>
            ))}
            <button
              className="backup-danger-button"
              type="button"
              disabled={restoring}
              onClick={() => void restore()}
            >
              {restoring ? '復元中...' : '確認した内容で復元'}
            </button>
          </section>
        )}
        {message && <div className="backup-success" role="status">{message}</div>}
        {error && <div className="error-box" role="alert">{error}</div>}
        <button className="secondary-button" type="button" onClick={onBack}>前のメニューへ戻る</button>
      </section>
    </main>
  );
}
