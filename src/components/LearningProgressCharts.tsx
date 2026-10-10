import { useMemo } from "react";
import type { Question } from "../types/Question";
import type { StudyHistory } from "../types/StudyHistory";
import { buildLearningTrend } from "../services/learningTrendService.ts";
import { selectChartTickIndexes } from "../services/chartLayoutService.ts";
import HelpButton from "./HelpButton";

type Props = { history: StudyHistory[]; questions: Question[]; days?: number; compact?: boolean };
type Key = "answers" | "unlearned" | "learning" | "mastered";

const SERIES_LABELS: Record<Key, string> = {
  answers: "回答数",
  unlearned: "未学習",
  learning: "学習中",
  mastered: "習得済み",
};

const points = (
  values: number[],
  left: number,
  right: number,
  height: number,
  max: number,
) =>
  values
    .map(
      (value, index) =>
        `${values.length === 1 ? (left + right) / 2 : left + (index / (values.length - 1)) * (right - left)},${height - (value / Math.max(1, max)) * height}`,
    )
    .join(" ");

function LineChart({ data, keys, max, label }: { data: ReturnType<typeof buildLearningTrend>; keys: Key[]; max: number; label: string }) {
  const width = 600;
  const height = 190;
  const left = 10;
  const right = width - 10;
  const tickIndexes = new Set(selectChartTickIndexes(data.length));
  return (
    <div className="line-chart-wrap">
      <svg className="line-chart" viewBox={`0 0 ${width} ${height + 30}`} role="img" aria-label={label}>
        {[0, 0.5, 1].map((ratio) => <line key={ratio} x1={left} x2={right} y1={height - ratio * height} y2={height - ratio * height} className="chart-grid-line" />)}
        {keys.map((key) => (
          <polyline
            key={key}
            className={`chart-series chart-series-${key}`}
            points={points(data.map((item) => item[key]), left, right, height, max)}
            aria-label={SERIES_LABELS[key]}
          />
        ))}
        {data.map((item, index) => tickIndexes.has(index) ? <text key={item.date} x={data.length === 1 ? width / 2 : left + (index / (data.length - 1)) * (right - left)} y={height + 24} textAnchor={index === 0 ? "start" : index === data.length - 1 ? "end" : "middle"}>{item.label}</text> : null)}
      </svg>
    </div>
  );
}

export default function LearningProgressCharts({ history, questions, days = 14, compact = false }: Props) {
  const data = useMemo(() => buildLearningTrend(history, questions, days), [history, questions, days]);
  const maxAnswers = data.reduce(
    (maximum, item) => Math.max(maximum, item.answers),
    1,
  );
  const maxQuestions = Math.max(1, questions.filter((item) => !item.archivedAt).length);
  const latest = data[data.length - 1];
  return (
    <section className={`learning-charts ${compact ? "is-compact" : ""}`} aria-label="学習量と理解度の推移">
      <div className="chart-heading">
        <div><span>LEARNING TREND</span><strong>{compact ? "直近7日の推移" : `直近${days}日の学習推移`}</strong></div>
        <HelpButton title="グラフの見方">回答数はその日に解いた延べ問題数です。理解度は各日終了時点の問題数で、回答履歴から再計算します。</HelpButton>
      </div>
      <div className="chart-legend" aria-label="グラフ系列の凡例">
        {(Object.keys(SERIES_LABELS) as Key[]).map((key) => (
          <span key={key} className={`chart-legend-item chart-${key}`}>
            <i aria-hidden="true" />{SERIES_LABELS[key]}
          </span>
        ))}
      </div>
      <article>
        <h3>毎日の学習量</h3>
        <LineChart data={data} keys={["answers"]} max={maxAnswers} label={`日別回答数。最新日は${latest.answers}問`} />
      </article>
      {!compact && (
        <article>
          <h3>理解度の推移</h3>
          <LineChart data={data} keys={["unlearned", "learning", "mastered"]} max={maxQuestions} label={`理解度別問題数。最新は未学習${latest.unlearned}問、学習中${latest.learning}問、習得済み${latest.mastered}問`} />
        </article>
      )}
    </section>
  );
}
