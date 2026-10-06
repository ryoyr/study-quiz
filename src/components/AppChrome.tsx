import { useEffect, useState, type ReactNode } from "react";
import AppIcon from "./AppIcon";
import FirstVisitGuide from "./FirstVisitGuide";
import GlobalAiChat from "./GlobalAiChat";
import HelpButton from "./HelpButton";
import NavIcon from "./NavIcon";

export type NavigationSection = "home" | "learn" | "records" | "manage" | "more";
type StatusProps = { remainingDays: number; completedToday: number; dailyMinimum: number; streakDays: number };
type NavigationProps = { active: NavigationSection; onNavigate: (section: NavigationSection) => void };
type FrameProps = StatusProps & NavigationProps & {
  children: ReactNode;
  showContextHelp?: boolean;
};
const NAV_ITEMS: Array<{ id: NavigationSection; label: string; shortLabel: string }> = [
  { id: "home", label: "ホーム", shortLabel: "ホーム" },
  { id: "learn", label: "学習", shortLabel: "学習" },
  { id: "records", label: "記録・分析", shortLabel: "記録" },
  { id: "manage", label: "問題・教材管理", shortLabel: "管理" },
  { id: "more", label: "その他", shortLabel: "その他" },
];
const HELP: Record<NavigationSection, { title: string; text: string }> = {
  home: { title: "ホーム", text: "今日やるべき問題数と進捗をまとめています。「今日の学習を開始」から最短で学習を始められます。" },
  learn: { title: "学習", text: "試験枠・トピック・理解度・出題方法を組み合わせられます。個別問題を指定した場合はその問題を優先します。" },
  records: { title: "記録・分析", text: "回答数、理解度、正答率、回答速度から、次に復習すべき内容を判断できます。" },
  manage: { title: "問題・教材管理", text: "問題の検索・編集・CSV追加・メモ・品質確認をまとめています。履歴を残すため、不要な問題はアーカイブします。" },
  more: { title: "その他", text: "学習設定、独立した配色テーマと明暗、バックアップ、AI補助機能を管理します。" },
};

function AppStatusBar({ remainingDays, completedToday, dailyMinimum, streakDays, onNavigate }: StatusProps & Pick<NavigationProps, "onNavigate">) {
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  const examLabel = remainingDays > 0 ? `試験まで ${remainingDays}日` : remainingDays === 0 ? "試験当日" : `試験日から ${Math.abs(remainingDays)}日`;
  const minimum = Math.max(0, dailyMinimum);
  const completed = Math.max(0, completedToday);
  const progress = minimum > 0 ? Math.min(100, Math.round((completed / minimum) * 100)) : 100;

  return (
    <header className="app-status-bar" aria-label="アプリと学習ステータス">
      <div className="app-status-inner">
        <button className="app-wordmark" type="button" onClick={() => onNavigate("home")} aria-label="Study Quiz ホームへ">
          <span className="app-wordmark-icon" aria-hidden="true"><AppIcon name="logo" /></span>
          <span>Study Quiz</span>
        </button>
        <div className="status-metrics">
          <span className={online ? "connection-status is-online" : "connection-status is-offline"} title={online ? "ネットワーク接続中" : "オフラインで利用中"}><i aria-hidden="true" />{online ? "オンライン" : "オフライン"}</span>
          <span className="status-chip">{examLabel}</span>
          <span className="status-chip status-progress" title={`今日の最低ライン達成率 ${progress}%`}>
            今日 {completed}/{minimum || "–"}問
            <i aria-hidden="true"><b style={{ width: `${progress}%` }} /></i>
          </span>
          <span className="status-chip status-streak">連続 {streakDays}日</span>
        </div>
      </div>
    </header>
  );
}

function BottomNavigation({ active, onNavigate }: NavigationProps) {
  return (
    <nav className="bottom-navigation" aria-label="主要機能">
      <div className="bottom-navigation-inner">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`${active === item.id ? "bottom-nav-item is-active" : "bottom-nav-item"}${item.id === "learn" ? " is-primary-destination" : ""}`}
            aria-current={active === item.id ? "page" : undefined}
            aria-label={item.label}
            onClick={() => onNavigate(item.id)}
          >
            <span className="bottom-nav-active-marker" aria-hidden="true" />
            <span className="bottom-nav-icon" aria-hidden="true"><NavIcon name={item.id} /></span>
            <span>{item.shortLabel}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

export default function AppChrome({ children, active, onNavigate, remainingDays, completedToday, dailyMinimum, streakDays, showContextHelp = true }: FrameProps) {
  const activeLabel = NAV_ITEMS.find((item) => item.id === active)?.label ?? "ホーム";
  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">本文へ移動</a>
      <AppStatusBar remainingDays={remainingDays} completedToday={completedToday} dailyMinimum={dailyMinimum} streakDays={streakDays} onNavigate={onNavigate} />
      <span className="route-announcer" aria-live="polite">{activeLabel}</span>
      <div id="main-content" className="app-content" tabIndex={-1}>{children}</div>
      <FirstVisitGuide />
      {showContextHelp && (
        <HelpButton className="context-help-control" title={HELP[active].title}>{HELP[active].text}</HelpButton>
      )}
      <GlobalAiChat />
      <BottomNavigation active={active} onNavigate={onNavigate} />
    </div>
  );
}
