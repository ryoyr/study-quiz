import type { DailyMinimumProgress } from "../services/dailyMinimumService";

type Props = { progress: DailyMinimumProgress };

export default function DailyMinimumCard({ progress }: Props) {
  return (
    <section
      className={
        progress.achieved ? "daily-minimum is-achieved" : "daily-minimum"
      }
    >
      <div className="daily-minimum-heading">
        <div>
          <span>今日の最低ライン</span>
          <strong>
            {progress.completed} / {progress.minimum}問
          </strong>
        </div>
        <b>{progress.achieved ? "達成" : `あと${progress.remaining}問`}</b>
      </div>
      <div
        className="daily-minimum-track"
        role="progressbar"
        aria-label="今日の最低ライン達成率"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress.rate * 100)}
      >
        <div style={{ width: `${Math.round(progress.rate * 100)}%` }} />
      </div>
      <p>
        {progress.achieved
          ? "最低ラインを達成しました。通常の学習計画は引き続き別に管理されます。"
          : "忙しい日でも、まずは最低ラインの達成を目指します。"}
      </p>
    </section>
  );
}

