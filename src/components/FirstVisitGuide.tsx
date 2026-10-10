import { useState } from "react";
import AppIcon, { type AppIconName } from "./AppIcon";
import { STORAGE_KEYS } from "../services/storageKeyRegistry.ts";

const STEPS: Array<{ icon: AppIconName; title: string; text: string }> = [
  { icon: "home", title: "今日やることを1画面で", text: "ホームには今日の問題数、目安時間、進捗を集約しています。大きな開始ボタンが最短の入口です。" },
  { icon: "learn", title: "条件を組み合わせて学習", text: "学習画面では範囲・理解度・出題方法を複数選択できます。選択結果は開始前に確認できます。" },
  { icon: "records", title: "記録から次の行動へ", text: "記録・分析画面で成績、回答速度、間違いを確認し、そのまま復習へ移動できます。" },
  { icon: "palette", title: "好みの見た目に変更", text: "設定では配色テーマとライト・ダークを別々に選べます。内容や学習データは変わりません。" },
  { icon: "help", title: "迷ったときはヘルプ", text: "右上のヘルプから、現在の画面の目的と基本操作をいつでも確認できます。" },
];

export default function FirstVisitGuide() {
  const [step, setStep] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEYS.uiGuideSeen) ? -1 : 0; }
    catch { return 0; }
  });
  if (step < 0) return null;
  const finish = () => {
    try { localStorage.setItem(STORAGE_KEYS.uiGuideSeen, "true"); } catch { /* 表示状態の保存失敗は学習を妨げない */ }
    setStep(-1);
  };
  const current = STEPS[step];
  return (
    <aside className="first-visit-guide" aria-live="polite" aria-label="初回操作ガイド">
      <div className="guide-header">
        <span className="guide-icon" aria-hidden="true"><AppIcon name={current.icon} /></span>
        <span className="guide-step">QUICK GUIDE · {step + 1} / {STEPS.length}</span>
        <button type="button" className="guide-close" aria-label="ガイドを閉じる" onClick={finish}><AppIcon name="close" /></button>
      </div>
      <strong>{current.title}</strong>
      <p>{current.text}</p>
      <div className="guide-progress" aria-hidden="true">{STEPS.map((_, index) => <i key={index} className={index <= step ? "is-complete" : ""} />)}</div>
      <div className="guide-actions">
        <button type="button" className="guide-skip" disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))}>戻る</button>
        <button type="button" className="guide-next" onClick={() => step + 1 < STEPS.length ? setStep(step + 1) : finish()}>
          {step + 1 < STEPS.length ? "次へ" : "学習を始める"}
        </button>
      </div>
    </aside>
  );
}
