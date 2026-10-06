import { useMemo, useState } from "react";
import type { StudySessionItem } from "../types/StudySession";
import { createTimeBasedSessionPlan } from "../services/timeBasedSessionService";
type Props = {
  items: StudySessionItem[];
  onStart: (
    questions: ReturnType<typeof createTimeBasedSessionPlan>["questions"],
  ) => void;
};
const OPTIONS = [10, 20, 30, 45];
export default function TimeBasedSessionCard({ items, onStart }: Props) {
  const [minutes, setMinutes] = useState(20);
  const plan = useMemo(
    () => createTimeBasedSessionPlan(items, minutes),
    [items, minutes],
  );
  return (
    <section className="time-session-card">
      <div className="time-session-heading">
        <div>
          <span>時間で学習</span>
          <strong>{minutes}分コース</strong>
        </div>
        <b>
          {plan.questions.length}問 / 約{plan.estimatedMinutes}分
        </b>
      </div>
      <div className="time-session-options" role="group" aria-label="学習時間">
        {OPTIONS.map((value) => (
          <button
            key={value}
            type="button"
            className={minutes === value ? "is-active" : ""}
            aria-pressed={minutes === value}
            onClick={() => setMinutes(value)}
          >
            {value}分
          </button>
        ))}
      </div>
      <p>
        現在の自動生成セッションから、1問45秒の目安で指定時間内に収まる問題を選びます。
      </p>
      <button
        type="button"
        className="time-session-start"
        disabled={plan.questions.length === 0}
        onClick={() => onStart(plan.questions)}
      >
        この時間で学習開始
      </button>
    </section>
  );
}
