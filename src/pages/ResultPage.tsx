
type Props = {
  correctCount: number;

  totalCount: number;

  onRestart: () => void;
};

export default function ResultPage({
  correctCount,
  totalCount,
  onRestart,
}: Props) {
  const percentage =
    Math.round(
      (
        correctCount /
        totalCount
      ) * 100,
    );

  return (
    <main className="app-shell">
      <section className="home-card">

        <p className="eyebrow">
          RESULT
        </p>

        <h1>
          {percentage}%
        </h1>

        <p>
          {correctCount}
          /
          {totalCount}
          問正解
        </p>

        <button
          className="primary-button"
          onClick={onRestart}
        >
          前のメニューへ戻る
        </button>

      </section>
    </main>
  );
}
