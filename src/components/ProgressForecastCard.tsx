import type { ProgressForecast } from "../services/progressForecastService";

type Props = { forecast: ProgressForecast };

const statusText = (forecast: ProgressForecast): string => {
  if (forecast.status === "AHEAD") return "必要ペースを上回っています";
  if (forecast.status === "ON_TRACK") return "必要ペースを維持しています";
  if (forecast.status === "BEHIND") return "必要ペースとの差があります";
  return "実績が蓄積されると比較できます";
};

const differenceText = (value: number): string =>
  `${value > 0 ? "+" : ""}${value.toFixed(1)}問/日`;

export default function ProgressForecastCard({ forecast }: Props) {
  return (
    <section
      className={`progress-forecast progress-${forecast.status.toLowerCase()}`}
    >
      <div className="progress-heading">
        <div>
          <span>試験日までの進捗予測</span>
          <strong>{statusText(forecast)}</strong>
        </div>
        <small>直近7日間の学習実績を使用</small>
      </div>
      <div className="progress-metrics">
        <article>
          <span>必要ペース</span>
          <strong>{forecast.requiredDailyPace}</strong>
          <small>問/日</small>
        </article>
        <article>
          <span>実績ペース</span>
          <strong>{forecast.recentDailyPace.toFixed(1)}</strong>
          <small>問/学習日</small>
        </article>
        <article>
          <span>差分</span>
          <strong>{differenceText(forecast.paceDifference)}</strong>
          <small>{forecast.activeDays}学習日</small>
        </article>
      </div>
      <div className="progress-submetrics">
        <span>
          高ウェイト問題定着率{" "}
          <strong>{Math.round(forecast.highWeightMasteryRate * 100)}%</strong>（
          {forecast.highWeightQuestionCount}問）
        </span>
        <span>
          弱点残数 <strong>{forecast.weakQuestionCount}問</strong>
        </span>
      </div>
      <p>学習量と定着状況の目安です。合否を判定するものではありません。</p>
    </section>
  );
}

