type Props = {
  correctCount: number;
  totalCount: number;
  onHome: () => void;
  onRetry: () => void;
};

export default function ResultPage({ correctCount, totalCount, onHome, onRetry }: Props) {
  const percentage = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
  const message = percentage >= 80
    ? 'よく定着しています。次の学習へ進みましょう。'
    : percentage >= 60
      ? 'あと少しです。間違えた問題を復習すると効果的です。'
      : '今回の問題をもう一度確認して、知識を定着させましょう。';

  return (
    <main className="app-shell result-shell">
      <section className="home-card result-card" aria-labelledby="result-title">
        <h1 id="result-title">学習結果</h1>
        <div className="result-score" aria-label={`正答率 ${percentage}%`}>
          <strong>{percentage}<small>%</small></strong>
          <span>{correctCount} / {totalCount}問正解</span>
        </div>
        <p className="result-message">{message}</p>
        <button className="primary-button" type="button" onClick={onHome}>ホームへ</button>
        <button className="secondary-button" type="button" onClick={onRetry}>同じ問題でもう一度</button>
      </section>
    </main>
  );
}
