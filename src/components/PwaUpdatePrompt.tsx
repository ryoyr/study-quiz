
import { useEffect, useRef, useState } from 'react';

type Notice = 'offline' | 'update' | null;

export default function PwaUpdatePrompt() {
  const [notice, setNotice] = useState<Notice>(null);
  const waitingWorker = useRef<ServiceWorker | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
    let refreshing = false;
    let disposed = false;
    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).then((registration) => {
      if (!navigator.serviceWorker.controller) {
        void navigator.serviceWorker.ready.then(() => {
          if (!disposed) setNotice('offline');
        });
      }
      if (registration.waiting) {
        waitingWorker.current = registration.waiting;
        setNotice('update');
      }
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            waitingWorker.current = worker;
            setNotice('update');
          }
        });
      });
    }).catch((error: unknown) => console.error('Service Worker registration failed.', error));
    return () => {
      disposed = true;
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  if (!notice) return null;
  const update = () => waitingWorker.current?.postMessage({ type: 'SKIP_WAITING' });

  return (
    <aside className="pwa-update-notice" role="status" aria-live="polite">
      <div className="pwa-update-content">
        <strong>{notice === 'update' ? '新しいバージョンがあります' : 'オフラインで利用できます'}</strong>
        <p>{notice === 'update' ? '更新すると最新の機能と修正が反映されます。回答確定後の更新を推奨します。' : '主要画面をネットワーク接続なしで利用できます。'}</p>
      </div>
      <div className="pwa-update-actions">
        {notice === 'update' && <button className="pwa-update-button" type="button" onClick={update}>更新して再読み込み</button>}
        <button className="pwa-dismiss-button" type="button" onClick={() => setNotice(null)}>{notice === 'update' ? 'あとで' : '閉じる'}</button>
      </div>
    </aside>
  );
}
