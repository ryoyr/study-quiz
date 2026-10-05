import { useEffect, useRef, useState } from "react";

type Notice = "install" | "offline" | "update" | "error" | null;

const isIos = (): boolean => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = (): boolean =>
  window.matchMedia("(display-mode: standalone)").matches ||
  ("standalone" in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone));

export default function PwaUpdatePrompt() {
  const [notice, setNotice] = useState<Notice>(null);
  const waitingWorker = useRef<ServiceWorker | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || import.meta.env.DEV) return;
    let refreshing = false;
    let disposed = false;
    let registration: ServiceWorkerRegistration | null = null;

    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };
    const checkForUpdate = () => {
      if (document.visibilityState === "visible") void registration?.update();
    };

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange,
    );
    document.addEventListener("visibilitychange", checkForUpdate);

    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then((result) => {
        registration = result;
        if (!navigator.serviceWorker.controller) {
          void navigator.serviceWorker.ready.then(() => {
            if (!disposed)
              setNotice(isIos() && !isStandalone() ? "install" : "offline");
          });
        }
        if (result.waiting) {
          waitingWorker.current = result.waiting;
          setNotice("update");
        }
        result.addEventListener("updatefound", () => {
          const worker = result.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (
              worker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              waitingWorker.current = worker;
              setNotice("update");
            }
          });
        });
      })
      .catch(() => {
        if (!disposed) setNotice("error");
      });

    const interval = window.setInterval(checkForUpdate, 60 * 60 * 1000);
    return () => {
      disposed = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", checkForUpdate);
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
    };
  }, []);

  if (!notice) return null;
  const update = () =>
    waitingWorker.current?.postMessage({ type: "SKIP_WAITING" });
  const title =
    notice === "update"
      ? "新しいバージョンがあります"
      : notice === "install"
        ? "iPhoneにインストールできます"
        : notice === "error"
          ? "オフライン準備に失敗しました"
          : "オフラインで利用できます";
  const detail =
    notice === "update"
      ? "回答確定後に更新すると、最新の機能と修正が反映されます。"
      : notice === "install"
        ? "Safariの共有ボタンから「ホーム画面に追加」を選択してください。"
        : notice === "error"
          ? "通信状態を確認し、オンライン時に再読み込みしてください。通常の学習データは端末内に残ります。"
          : "主要画面をネットワーク接続なしで利用できます。";

  return (
    <aside
      className="pwa-update-notice"
      role={notice === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      <div className="pwa-update-content">
        <strong>{title}</strong>
        <p>{detail}</p>
      </div>
      <div className="pwa-update-actions">
        {notice === "update" && (
          <button className="pwa-update-button" type="button" onClick={update}>
            更新して再読み込み
          </button>
        )}
        {notice === "error" && (
          <button
            className="pwa-update-button"
            type="button"
            onClick={() => window.location.reload()}
          >
            再試行
          </button>
        )}
        <button
          className="pwa-dismiss-button"
          type="button"
          onClick={() => setNotice(null)}
        >
          {notice === "update" ? "あとで" : "閉じる"}
        </button>
      </div>
    </aside>
  );
}

