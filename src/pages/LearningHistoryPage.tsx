import { useMemo, useState } from "react";
import type { Question } from "../types/Question";
import type { StudyHistory } from "../types/StudyHistory";
import { fsrsRatingLabel } from "../services/fsrsAdapter";
import {
  formatHistoryCorrectAnswer,
  formatHistoryQuestionResponse,
  historyQuestionText,
} from "../services/questionAnswerModel";
type Props = {
  history: StudyHistory[];
  questions: Question[];
  onBack: () => void;
};
type ResultFilter = "ALL" | "CORRECT" | "WRONG";
type PeriodFilter = "DAYS_7" | "DAYS_30" | "ALL";
const periodStart = (period: PeriodFilter): number => {
  if (period === "ALL") return 0;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (period === "DAYS_7" ? 6 : 29));
  return d.getTime();
};
export default function LearningHistoryPage({
  history,
  questions,
  onBack,
}: Props) {
  const [result, setResult] = useState<ResultFilter>("ALL");
  const [period, setPeriod] = useState<PeriodFilter>("DAYS_30");
  const [category, setCategory] = useState("ALL");
  const [page, setPage] = useState(1);
  const size = 20;
  const questionMap = useMemo(
    () => new Map(questions.map((q) => [q.id, q])),
    [questions],
  );
  const categories = useMemo(
    () => ["ALL", ...new Set(questions.map((q) => q.category))],
    [questions],
  );
  const filtered = useMemo(
    () =>
      history
        .filter((item) => {
          if (new Date(item.answeredAt).getTime() < periodStart(period))
            return false;
          if (result === "CORRECT" && !item.correct) return false;
          if (result === "WRONG" && item.correct) return false;
          if (category !== "ALL" && item.category !== category) return false;
          return true;
        })
        .sort((a, b) => b.answeredAt.localeCompare(a.answeredAt)),
    [history, period, result, category],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * size, current * size);
  const change = () => setPage(1);
  return (
    <main className="app-shell">
      <section className="home-card learning-history-card">
        <p className="eyebrow">LEARNING HISTORY</p>
        <h1>学習履歴</h1>
        <div className="history-filters">
          <label>
            <span>期間</span>
            <select
              value={period}
              onChange={(e) => {
                setPeriod(e.target.value as PeriodFilter);
                change();
              }}
            >
              <option value="DAYS_7">7日</option>
              <option value="DAYS_30">30日</option>
              <option value="ALL">全期間</option>
            </select>
          </label>
          <label>
            <span>結果</span>
            <select
              value={result}
              onChange={(e) => {
                setResult(e.target.value as ResultFilter);
                change();
              }}
            >
              <option value="ALL">すべて</option>
              <option value="CORRECT">正解</option>
              <option value="WRONG">不正解</option>
            </select>
          </label>
          <label>
            <span>カテゴリ</span>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                change();
              }}
            >
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="history-count">該当 {filtered.length}件</div>
        <div className="history-list">
          {visible.map((item) => {
            const q = questionMap.get(item.questionId);
            return (
              <article
                key={item.id}
                className={
                  item.correct
                    ? "history-item is-correct"
                    : "history-item is-wrong"
                }
              >
                <div className="history-heading">
                  <div>
                    <span>
                      {new Date(item.answeredAt).toLocaleString("ja-JP")} /{" "}
                      {item.category}
                    </span>
                    <strong>
                       {historyQuestionText(item, q)}
                    </strong>
                  </div>
                  <b>{item.correct ? "正解" : "不正解"}</b>
                </div>
                <div className="history-values">
                   <span>
                     回答 {" "}
                     <strong>{formatHistoryQuestionResponse(item, q)}</strong>
                   </span>
                   {formatHistoryCorrectAnswer(item, q) && (
                     <span>
                       正答 {" "}
                       <strong>{formatHistoryCorrectAnswer(item, q)}</strong>
                     </span>
                   )}
                  <span>
                    回答時間{" "}
                    <strong>{item.responseTimeSeconds.toFixed(1)}秒</strong>
                  </span>
                  <span>
                    即答スコア{" "}
                    <strong>{Math.round(item.instantScore * 100)}%</strong>
                  </span>
                  <span>
                    記憶評価{" "}
                    <strong>
                      {item.fsrsRating
                        ? fsrsRatingLabel(item.fsrsRating)
                        : "未評価"}
                    </strong>
                  </span>
                </div>
              </article>
            );
          })}
          {visible.length === 0 && (
            <div className="empty-state">条件に一致する履歴がありません。</div>
          )}
        </div>
        <div className="history-pagination">
          <button
            type="button"
            disabled={current <= 1}
            onClick={() => setPage(current - 1)}
          >
            前へ
          </button>
          <span>
            {current} / {pages}
          </span>
          <button
            type="button"
            disabled={current >= pages}
            onClick={() => setPage(current + 1)}
          >
            次へ
          </button>
        </div>
        <button className="secondary-button" type="button" onClick={onBack}>
          前のメニューへ戻る
        </button>
      </section>
    </main>
  );
}
