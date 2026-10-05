import { useEffect, useState, type ReactNode } from "react";
import FirstVisitGuide from "./FirstVisitGuide";
import GlobalAiChat from "./GlobalAiChat";
import HelpButton from "./HelpButton";
import NavIcon from "./NavIcon";

export type NavigationSection = "home" | "learn" | "records" | "manage" | "more";
type StatusProps = { remainingDays: number; completedToday: number; dailyMinimum: number; streakDays: number };
type NavigationProps = { active: NavigationSection; onNavigate: (section: NavigationSection) => void };
type FrameProps = StatusProps & NavigationProps & { children: ReactNode };
const NAV_ITEMS: Array<{ id: NavigationSection; label: string }> = [
  { id: "home", label: "ホーム" }, { id: "learn", label: "学習" }, { id: "records", label: "記録" }, { id: "manage", label: "管理" }, { id: "more", label: "その他" },
];
const HELP: Record<NavigationSection, { title: string; text: string }> = {
  home: { title: "ホーム", text: "今日の自動計画、最低ライン、連続学習、理解度を確認します。開始ボタンは設定済みの出題初期値を使用します。" },
  learn: { title: "学習", text: "試験枠・トピック・理解度・出題方法を選べます。個別問題を指定すると、その問題だけでセッションを作成します。" },
  records: { title: "記録・分析", text: "日別回答数、理解度推移、正答率、回答速度、学習履歴を確認して次の学習を判断します。" },
  manage: { title: "問題・教材管理", text: "LPIC問題の検索・編集・CSV追加・アーカイブ・品質確認を行います。削除の代わりにアーカイブして履歴を保持します。" },
  more: { title: "その他", text: "出題の初期値、テーマ、試験日、バックアップ、AI補助機能を管理します。" },
};

function AppStatusBar({ remainingDays, completedToday, dailyMinimum, streakDays }: StatusProps) {
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update); window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  const examLabel = remainingDays > 0 ? `試験まで ${remainingDays}日` : remainingDays === 0 ? "試験当日" : `試験日から ${Math.abs(remainingDays)}日`;
  const minimumLabel = dailyMinimum > 0 ? `今日 ${completedToday}/${dailyMinimum}問` : `今日 ${completedToday}問`;
  return <header className="app-status-bar" aria-label="学習ステータス"><div className="app-status-inner"><span className={online ? "connection-status is-online" : "connection-status is-offline"}><i aria-hidden="true" />{online ? "オンライン" : "オフライン"}</span><span>{examLabel}</span><span>{minimumLabel}</span><span>連続 {streakDays}日</span></div></header>;
}
function BottomNavigation({ active, onNavigate }: NavigationProps) {
  return <nav className="bottom-navigation" aria-label="主要機能"><div className="bottom-navigation-inner">{NAV_ITEMS.map((item) => <button key={item.id} type="button" className={active === item.id ? "bottom-nav-item is-active" : "bottom-nav-item"} aria-current={active === item.id ? "page" : undefined} onClick={() => onNavigate(item.id)}><span className="bottom-nav-icon" aria-hidden="true"><NavIcon name={item.id} /></span><span>{item.label}</span></button>)}</div></nav>;
}
export default function AppChrome({ children, active, onNavigate, remainingDays, completedToday, dailyMinimum, streakDays }: FrameProps) {
  return (
    <div className="app-frame">
      <AppStatusBar remainingDays={remainingDays} completedToday={completedToday} dailyMinimum={dailyMinimum} streakDays={streakDays} />
      {children}
      <FirstVisitGuide />
      <HelpButton className="global-help-control" title={HELP[active].title}>{HELP[active].text}</HelpButton>
      <GlobalAiChat />
      <BottomNavigation active={active} onNavigate={onNavigate} />
    </div>
  );
}
