import { useState } from "react";
import type { StudySessionItem } from "../types/StudySession";
type Props = { items: StudySessionItem[] };
const SOURCE_LABEL = {
  REVIEW: "FSRS復習期限",
  WEAK: "弱点問題",
  NEW: "新規問題",
} as const;
const reason = (item: StudySessionItem): string => {
  const labels = item.sourceTypes.map((source) => SOURCE_LABEL[source]);
  const extras: string[] = [];
  if (item.question.weight >= 3) extras.push("高ウェイト");
  if (item.question.difficulty >= 4) extras.push("高難易度");
  return [...labels, ...extras].join("・") || "通常優先度";
};
export default function SessionPlanDetails({ items }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <section className="session-plan-details">
      <button
        type="button"
        className="session-plan-toggle"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? "出題理由を閉じる" : "出題理由を確認する"}（{items.length}問）
      </button>
      {open && (
        <div className="session-plan-list">
          {items.map((item) => (
            <article key={`${item.order}-${item.question.id}`}>
              <span className="session-order">{item.order}</span>
              <div>
                <strong>{item.question.text}</strong>
                <small>
                  {item.question.category} / {reason(item)}
                </small>
              </div>
              <b>{Math.round(item.priorityScore * 100)}</b>
            </article>
          ))}
        </div>
      )}
      <p>
        スコアはFSRS期限、弱点、重要度、試験日の近さ、新規問題を統合した相対的な優先度です。
      </p>
    </section>
  );
}
