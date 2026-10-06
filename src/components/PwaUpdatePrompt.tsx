import { useEffect, useRef, useState } from "react";

type Notice = "install" | "offline" | "update" | "error" | null;

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const isIos = (): boolean => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = (): boolean =>
  window.matchMedia("(display-mode: standalone)").matches ||
  ("standalone" in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone));

export default function PwaUpdatePrompt() {
  const [notice, setNotice] = useState<Notice>(null);
  const waitingWorker = useRef<ServiceWorker | null>(null);
  const installPrompt = useRef<InstallPromptEvent | null>(null);

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
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      installPrompt.current = event as InstallPromptEvent;
      if (!isStandalone()) setNotice("install");
    };
    const onAppInstalled = () => {
      installPrompt.current = null;
      setNotice(null);
    };

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange,
    );
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    document.addEventListener("visibilitychange", checkForUpdate);

    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then((result) => {
        registration = result;
        if (!navigator.serviceWorker.controller) {
          void navigator.serviceWorker.ready.then(() => {
            if (!disposed) {
              setNotice(isIos() && !isStandalone() ? "install" : "offline");
            }
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
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
    };
  }, []);

  if (!notice) return null;

  const applyUpdate = () =>
    waitingWorker.current?.postMessage({ type: "SKIP_WAITING" });
  const install = async () => {
    const prompt = installPrompt.current;
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    installPrompt.current = null;
    setNotice(null);
  };
  const canPromptInstall = notice === "install" && Boolean(installPrompt.current);
  const title =
    notice === "update"
      ? "新しいバージョンがあります"
      : notice === "install"
        ? "端末にインストールできます"
        : notice === "error"
          ? "オフライン準備に失敗しました"
          : "オフラインで利用できます";
  const detail =
    notice === "update"
      ? "回答確定後に更新すると、最新の機能と修正が反映されます。"
      : notice === "install"
        ? canPromptInstall
          ? "インストールすると、ホーム画面からすぐに起動できます。"
          : "Safariの共有ボタンから「ホーム画面に追加」を選択してください。"
        : notice === "error"
          ? "通信状態を確認し、オンライン時に再読み込みしてください。通常の学習データは端末内に残ります。"
          : "主要画面をネットワーク接続なしで利用できます。";

  return (
    <aside
      className="pwa-update-notice"
      role={notice === "error" ? "alert" : "status"}
      aria-live={notice === "error" ? "assertive" : "polite"}
      aria-label="アプリのインストールと更新"
    >
      <div className="pwa-update-content">
        <strong>{title}</strong>
        <p>{detail}</p>
      </div>
      <div className="pwa-update-actions">
        {notice === "update" && (
          <button
            className="pwa-update-button"
            type="button"
            onClick={applyUpdate}
          >
            更新して再読み込み
          </button>
        )}
        {canPromptInstall && (
          <button
            className="pwa-update-button"
            type="button"
            onClick={() => void install()}
          >
            インストール
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
