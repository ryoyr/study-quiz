
import type { Setup } from "../types/Setup";

type Props = {
  setup: Setup;

  onChange: (
    setup: Setup,
  ) => void;

  onSave: () => void;

  error: string;
};

export default function SetupPage({
  setup,
  onChange,
  onSave,
  error,
}: Props) {
  return (
    <main className="app-shell">
      <section className="home-card">

        <p className="eyebrow">
          INITIAL SETUP
        </p>

        <h1>
          初回設定
        </h1>

        <div className="form-grid">

          <label className="form-item">
            <span>
              試験名
            </span>

            <input
              value={setup.name}
              onChange={(e) =>
                onChange({
                  ...setup,
                  name: e.target.value,
                })
              }
            />
          </label>

          <label className="form-item">
            <span>
              試験日
            </span>

            <input
              type="date"
              value={setup.examDate}
              onChange={(e) =>
                onChange({
                  ...setup,
                  examDate:
                    e.target.value,
                })
              }
            />
          </label>

          <label className="form-item">
            <span>
              新規問題上限
            </span>

            <input
              type="number"
              value={
                setup.dailyNewLimit
              }
              onChange={(e) =>
                onChange({
                  ...setup,
                  dailyNewLimit:
                    Number(
                      e.target.value,
                    ),
                })
              }
            />
          </label>

          <label className="form-item">
            <span>
              総問題上限
            </span>

            <input
              type="number"
              value={
                setup.dailyQuestionLimit
              }
              onChange={(e) =>
                onChange({
                  ...setup,
                  dailyQuestionLimit:
                    Number(
                      e.target.value,
                    ),
                })
              }
            />
          </label>

        </div>

        {error && (
          <div className="error-box">
            {error}
          </div>
        )}

        <button
          className="primary-button"
          onClick={onSave}
        >
          保存して開始
        </button>

      </section>
    </main>
  );
}
