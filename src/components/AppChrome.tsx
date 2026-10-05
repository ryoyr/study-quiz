import { useEffect, useState, type ReactNode } from "react";

export type NavigationSection =
  | "home"
  | "learn"
  | "records"
  | "manage"
  | "more";

type StatusProps = {
  remainingDays: number;
  completedToday: number;
  dailyMinimum: number;
  streakDays: number;
};

type NavigationProps = {
  active: NavigationSection;
  onNavigate: (section: NavigationSection) => void;
};

type FrameProps = StatusProps &
  NavigationProps & {
    children: ReactNode;
  };

const NAV_ITEMS: Array<{ id: NavigationSection; icon: string; label: string }> =
  [
    { id: "home", icon: "⌂", label: "ホーム" },
    { id: "learn", icon: "▶", label: "学習" },
    { id: "records", icon: "▥", label: "記録" },
    { id: "manage", icon: "▦", label: "管理" },
    { id: "more", icon: "•••", label: "その他" },
  ];

function AppStatusBar({
  remainingDays,
  completedToday,
  dailyMinimum,
  streakDays,
}: StatusProps) {
  const [online, setOnline] = useState(
    () => typeof navigator === "undefined" || navigator.onLine,
  );

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const examLabel =
    remainingDays > 0
      ? `試験まで ${remainingDays}日`
      : remainingDays === 0
        ? "試験当日"
        : `試験日から ${Math.abs(remainingDays)}日`;
  const minimumLabel =
    dailyMinimum > 0
      ? `今日 ${completedToday}/${dailyMinimum}問`
      : `今日 ${completedToday}問`;

  return (
    <header className="app-status-bar" aria-label="学習ステータス">
      <div className="app-status-inner">
        <span
          className={
            online
              ? "connection-status is-online"
              : "connection-status is-offline"
          }
        >
          <i aria-hidden="true" />
          {online ? "オンライン" : "オフライン"}
        </span>
        <span>{examLabel}</span>
        <span>{minimumLabel}</span>
        <span>連続 {streakDays}日</span>
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
            className={
              active === item.id
                ? "bottom-nav-item is-active"
                : "bottom-nav-item"
            }
            aria-current={active === item.id ? "page" : undefined}
            onClick={() => onNavigate(item.id)}
          >
            <span className="bottom-nav-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

export default function AppChrome({
  children,
  active,
  onNavigate,
  remainingDays,
  completedToday,
  dailyMinimum,
  streakDays,
}: FrameProps) {
  return (
    <div className="app-frame">
      <AppStatusBar
        remainingDays={remainingDays}
        completedToday={completedToday}
        dailyMinimum={dailyMinimum}
        streakDays={streakDays}
      />
      {children}
      <BottomNavigation active={active} onNavigate={onNavigate} />
    </div>
  );
}
