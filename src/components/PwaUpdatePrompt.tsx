
import { useRegisterSW } from 'virtual:pwa-register/react';

export default function PwaUpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error: unknown) {
      console.error('Service Worker registration failed.', error);
    },
  });

  if (!offlineReady && !needRefresh) return null;
  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  return <aside className="pwa-update-notice" role="status" aria-live="polite">
    <div className="pwa-update-content">
      <strong>{needRefresh ? '新しいバージョンがあります' : 'オフラインで利用できます'}</strong>
      <p>{needRefresh ? '更新すると、最新の機能と修正が反映されます。学習中の場合は回答を終えてから更新してください。' : '主要な画面をネットワーク接続なしで利用できます。'}</p>
    </div>
    <div className="pwa-update-actions">
      {needRefresh && <button className="pwa-update-button" type="button" onClick={() => void updateServiceWorker(true)}>更新して再読み込み</button>}
      <button className="pwa-dismiss-button" type="button" onClick={close}>{needRefresh ? 'あとで' : '閉じる'}</button>
    </div>
  </aside>;
}
