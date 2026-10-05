import { useMemo, useState } from "react";
import type { Question } from "../types/Question";
import type { QuestionState } from "../types/QuestionState";
import type { StudyHistory } from "../types/StudyHistory";
import {
  calculateStatisticsForPeriod,
  type StatisticsPeriod,
} from "../services/statisticsService";

type Props = {
  history: StudyHistory[];
  questionStates: QuestionState[];
  questions: Question[];
  instantThresholdSeconds: number;
  onBack: () => void;
};

type PeriodOption = { value: StatisticsPeriod; label: string };
const PERIOD_OPTIONS: PeriodOption[] = [
  { value: "TODAY", label: "今日" },
  { value: "DAYS_7", label: "7日" },
  { value: "DAYS_30", label: "30日" },
  { value: "ALL", label: "全期間" },
];
const percent = (value: number): string => `${Math.round(value * 100)}%`;
const seconds = (value: number): string => `${value.toFixed(1)}秒`;

export default function StatisticsPage({
  history,
  questionStates,
  questions,
  instantThresholdSeconds,
  onBack,
}: Props) {
  const [period, setPeriod] = useState<StatisticsPeriod>("DAYS_7");
  const stats = useMemo(
    () =>
      calculateStatisticsForPeriod(history, instantThresholdSeconds, period),
    [history, instantThresholdSeconds, period],
  );
  const categories = useMemo(
    () =>
      [...new Set(questions.map((question) => question.category))].sort(
        (a, b) => a.localeCompare(b, "ja"),
      ),
    [questions],
  );
  const selectedLabel =
    PERIOD_OPTIONS.find((item) => item.value === period)?.label ?? "";

  return (
    <main className="app-shell">
      <section className="home-card statistics-card">
        <p className="eyebrow">STATISTICS</p>
        <h1>学習統計</h1>
        <div
          className="statistics-period-tabs"
          role="group"
          aria-label="統計期間"
        >
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={
                period === option.value
                  ? "statistics-period-button is-active"
                  : "statistics-period-button"
              }
              aria-pressed={period === option.value}
              onClick={() => setPeriod(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="statistics-period-caption">表示期間: {selectedLabel}</p>
        {stats.totalAnswers === 0 ? (
          <div className="empty-state">選択期間に回答履歴がありません。</div>
        ) : (
          <>
            <div className="stats-grid statistics-summary">
              <article>
                <span>総回答数</span>
                <strong>{stats.totalAnswers}</strong>
                <small>問</small>
              </article>
              <article>
                <span>正答率</span>
                <strong>{percent(stats.accuracyRate)}</strong>
              </article>
              <article>
                <span>平均回答時間</span>
                <strong className="compact-value">
                  {seconds(stats.averageResponseTimeSeconds)}
                </strong>
              </article>
              <article>
                <span>平均即答スコア</span>
                <strong>{percent(stats.averageInstantScore)}</strong>
              </article>
              <article>
                <span>即答正解率</span>
                <strong>{percent(stats.instantAnswerRate)}</strong>
                <small>{instantThresholdSeconds}秒未満</small>
              </article>
            </div>
            <h2 className="section-title">カテゴリ別</h2>
            <div className="category-stat-list">
              {stats.categories.map((item) => {
                const categoryQuestions = questions.filter(
                  (question) => question.category === item.category,
                );
                const mastered = categoryQuestions.filter(
                  (question) =>
                    questionStates.find(
                      (state) => state.questionId === question.id,
                    )?.masteryLevel === "MASTERED",
                ).length;
                return (
                  <article className="category-stat" key={item.category}>
                    <div className="category-stat-heading">
                      <strong>{item.category}</strong>
                      <span>{item.answers}回答</span>
                    </div>
                    <div className="category-stat-values">
                      <span>
                        正答率 <strong>{percent(item.accuracyRate)}</strong>
                      </span>
                      <span>
                        平均時間{" "}
                        <strong>
                          {seconds(item.averageResponseTimeSeconds)}
                        </strong>
                      </span>
                      <span>
                        習得率{" "}
                        <strong>
                          {percent(
                            categoryQuestions.length
                              ? mastered / categoryQuestions.length
                              : 0,
                          )}
                        </strong>
                      </span>
                    </div>
                  </article>
                );
              })}
              {categories
                .filter(
                  (category) =>
                    !stats.categories.some(
                      (item) => item.category === category,
                    ),
                )
                .map((category) => (
                  <article className="category-stat" key={category}>
                    <div className="category-stat-heading">
                      <strong>{category}</strong>
                      <span>期間内未回答</span>
                    </div>
                    <div className="category-stat-values">
                      <span>
                        正答率 <strong>0%</strong>
                      </span>
                      <span>
                        平均時間 <strong>0.0秒</strong>
                      </span>
                      <span>
                        習得率{" "}
                        <strong>
                          {percent(
                            questions
                              .filter(
                                (question) => question.category === category,
                              )
                              .filter(
                                (question) =>
                                  questionStates.find(
                                    (state) => state.questionId === question.id,
                                  )?.masteryLevel === "MASTERED",
                              ).length /
                              Math.max(
                                1,
                                questions.filter(
                                  (question) => question.category === category,
                                ).length,
                              ),
                          )}
                        </strong>
                      </span>
                    </div>
                  </article>
                ))}
            </div>
          </>
        )}
        <button className="secondary-button" type="button" onClick={onBack}>
          前のメニューへ戻る
        </button>
      </section>
    </main>
  );
}
