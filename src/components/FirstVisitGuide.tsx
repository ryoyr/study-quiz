import { useState } from "react";
import { STORAGE_KEYS } from "../services/storageKeyRegistry.ts";

const STEPS = [
  { title: "まずは「今日の学習」", text: "ホームの開始ボタンで、設定した試験範囲と出題条件から今日の問題を自動作成します。" },
  { title: "範囲は学習画面で変更", text: "試験枠・カテゴリ・理解度・出題モードを変更し、必要なら問題を1問ずつ指定できます。" },
  { title: "記録で伸びを確認", text: "日ごとの回答数と、未学習・学習中・習得済みの推移を折れ線グラフで確認できます。" },
  { title: "迷ったら「？」", text: "画面右下の「？」を押すと、その画面の目的と基本操作をいつでも確認できます。" },
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
  return (
    <aside className="first-visit-guide" aria-live="polite" aria-label="初回操作ガイド">
      <div className="guide-arrow" aria-hidden="true" />
      <span className="guide-step">{step + 1} / {STEPS.length}</span>
      <strong>{STEPS[step].title}</strong>
      <p>{STEPS[step].text}</p>
      <div>
        <button type="button" className="guide-skip" onClick={finish}>閉じる</button>
        <button type="button" className="guide-next" onClick={() => step + 1 < STEPS.length ? setStep(step + 1) : finish()}>
          {step + 1 < STEPS.length ? "次へ" : "はじめる"}
        </button>
      </div>
    </aside>
  );
}
