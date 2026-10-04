import type { Setup } from "../types/Setup";
import type { SessionPlan } from "../types/Session";

type Props = {
  setup: Setup;

  remainingDays: number;

  session: SessionPlan;

  onStart: () => void;

  onEdit: () => void;
};

export default function HomePage({
  setup,
  remainingDays,
  session,
  onStart,
  onEdit,
}: Props) {
  return (
    <main className="app-shell">
      <section className="home-card">

        <div className="brand-mark">
          Q
        </div>

        <p className="eyebrow">
          EXAM MODE
        </p>

        <h1>
          {setup.name}
        </h1>

        <div className="exam-summary">

          <div className="summary-row">
            <span>
              試験日
            </span>

            <strong>
              {setup.examDate}
            </strong>
          </div>

          <div className="summary-row">
            <span>
              残り日数
            </span>

            <strong>
              {remainingDays}日
            </strong>
          </div>

        </div>

        <div className="stats-grid">

          <article>
            <span>新規</span>
            <strong>
              {session.newQuestions}
            </strong>
          </article>

          <article>
            <span>復習</span>
            <strong>
              {session.reviewQuestions}
            </strong>
          </article>

          <article>
            <span>合計</span>
            <strong>
              {session.totalQuestions}
            </strong>
          </article>

        </div>

        <button
          className="primary-button large-button"
          onClick={onStart}
        >
          今日の学習を開始
        </button>

        <button
          className="secondary-button"
          onClick={onEdit}
        >
          設定変更
        </button>

      </section>
    </main>
  );
}