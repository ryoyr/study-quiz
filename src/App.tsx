import { useEffect, useMemo, useState } from "react";
import "./App.css";

import { loadSetup, saveSetup } from "./services/setupStorage";

import { loadHistory, saveHistory } from "./services/historyStorage";

import type { StudyHistory } from "./types/StudyHistory";

import type { Setup } from "./types/Setup";
import { createDefaultSetup } from "./types/Setup";

import { questions } from "./data/questions";

import { createTodaySession } from "./services/sessionService";

export default function App() {
  const [quizStarted, setQuizStarted] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);

  const [setup, setSetup] = useState<Setup>(createDefaultSetup());
  const [history, setHistory] = useState<StudyHistory[]>([]);

  const [loaded, setLoaded] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

  const [showSetup, setShowSetup] = useState(false);

  const [sessionStarted, setSessionStarted] = useState(false);

  useEffect(() => {
    const saved = loadSetup();

    if (saved) {
      setSetup(saved);
    }

    const savedHistory = loadHistory();

    setHistory(savedHistory);

    setLoaded(true);
  }, []);

  const categories = useMemo(() => {
    return ["ALL", ...new Set(questions.map((question) => question.category))];
  }, []);

  const filteredQuestions = useMemo(() => {
    if (selectedCategory === "ALL") {
      return questions;
    }

    return questions.filter(
      (question) => question.category === selectedCategory,
    );
  }, [selectedCategory]);

  const session = createTodaySession(setup);

  const remainingDays = useMemo(() => {
    const today = new Date();

    today.setHours(0, 0, 0, 0);

    const exam = new Date(setup.examDate);

    exam.setHours(0, 0, 0, 0);

    return Math.ceil(
      (exam.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );
  }, [setup.examDate]);

  const saveAnswerHistory = (correct: boolean) => {
    const item: StudyHistory = {
      id: crypto.randomUUID(),

      questionId: filteredQuestions[questionIndex].id,

      category: filteredQuestions[questionIndex].category,

      selectedIndex: selectedAnswer ?? -1,

      correct,

      answeredAt: new Date().toISOString(),
    };

    const updated = [item, ...history];

    setHistory(updated);

    saveHistory(updated);
  };

  if (!loaded) {
    return (
      <main className="app-shell">
        <section className="home-card">
          <h1>Loading...</h1>
        </section>
      </main>
    );
  }

  if (showSetup) {
    return (
      <main className="app-shell">
        <section className="home-card">
          <h1>設定変更</h1>

          <div className="form-grid">
            <label className="form-item">
              <span>試験名</span>
              <input
                value={setup.name}
                onChange={(e) =>
                  setSetup({
                    ...setup,
                    name: e.target.value,
                  })
                }
              />
            </label>

            <label className="form-item">
              <span>試験日</span>
              <input
                type="date"
                value={setup.examDate}
                onChange={(e) =>
                  setSetup({
                    ...setup,
                    examDate: e.target.value,
                  })
                }
              />
            </label>
          </div>

          <button
            className="primary-button"
            onClick={() => {
              saveSetup(setup);
              setShowSetup(false);
            }}
          >
            保存
          </button>

          <button
            className="secondary-button"
            onClick={() => setShowSetup(false)}
          >
            戻る
          </button>
        </section>
      </main>
    );
  }

  if (sessionStarted) {
    return (
      <main className="app-shell">
        <section className="home-card">
          <p className="eyebrow">SESSION</p>

          <h1>学習セッション</h1>

          <div className="exam-summary">
            <div className="summary-row">
              <span>カテゴリ</span>

              <strong>{selectedCategory}</strong>
            </div>

            <div className="summary-row">
              <span>対象問題数</span>

              <strong>{filteredQuestions.length}</strong>
            </div>

            <div className="summary-row">
              <span>今日の目標</span>

              <strong>{session.totalQuestions}問</strong>
            </div>
          </div>

          {/* Session画面 */}
          <button
            className="primary-button"
            type="button"
            onClick={() => {
              setSessionStarted(false);
              setQuizStarted(true);
              setQuestionIndex(0);
              setSelectedAnswer(null);
              setShowAnswer(false);
            }}
          >
            学習開始
          </button>

          <button
            className="secondary-button"
            type="button"
            onClick={() => setSessionStarted(false)}
          >
            戻る
          </button>
        </section>
      </main>
    );
  }

  if (quizStarted) {
    const question = filteredQuestions[questionIndex];

    return (
      <main className="app-shell">
        <section className="home-card">
          <p className="eyebrow">{question.category}</p>

          <h1
            style={{
              fontSize: "1.6rem",
            }}
          >
            {question.text}
          </h1>

          <div className="form-grid">
            {question.choices.map((choice, index) => (
              <button
                key={index}
                className="secondary-button"
                onClick={() => setSelectedAnswer(index)}
              >
                {choice}
              </button>
            ))}
          </div>

          {selectedAnswer !== null && (
            <button
              className="primary-button"
              onClick={() => {
                const correct = selectedAnswer === question.answerIndex;

                saveAnswerHistory(correct);

                setShowAnswer(true);
              }}
            >
              回答する
            </button>
          )}

          {showAnswer && (
            <>
              <div className="exam-summary">
                <div className="summary-row">
                  <span>判定</span>

                  <strong>
                    {selectedAnswer === question.answerIndex
                      ? "正解"
                      : "不正解"}
                  </strong>
                </div>

                <div className="summary-row">
                  <span>解説</span>

                  <strong>{question.explanation}</strong>
                </div>
              </div>

              <button
                className="primary-button"
                onClick={() => {
                  if (questionIndex + 1 < filteredQuestions.length) {
                    setQuestionIndex(questionIndex + 1);
                    setSelectedAnswer(null);
                    setShowAnswer(false);
                  } else {
                    setQuizStarted(false);
                    setQuestionIndex(0);
                    setSelectedAnswer(null);
                    setShowAnswer(false);
                  }
                }}
              >
                {questionIndex + 1 < filteredQuestions.length
                  ? "次の問題"
                  : "終了"}
              </button>
            </>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="home-card">
        <div className="brand-mark">Q</div>

        <p className="eyebrow">EXAM MODE</p>

        <h1>{setup.name}</h1>

        <div className="exam-summary">
          <div className="summary-row">
            <span>試験日</span>

            <strong>{setup.examDate}</strong>
          </div>

          <div className="summary-row">
            <span>残り日数</span>

            <strong>{remainingDays}日</strong>
          </div>
        </div>

        <div className="stats-grid">
          <article>
            <span>回答数</span>

            <strong>{history.length}</strong>

            <small>問</small>
          </article>

          <article>
            <span>正解数</span>

            <strong>{history.filter((h) => h.correct).length}</strong>

            <small>問</small>
          </article>
        </div>
        <div className="stats-grid">
          <article>
            <span>新規上限</span>

            <strong>{setup.dailyNewLimit}</strong>

            <small>問</small>
          </article>

          <article>
            <span>総問題上限</span>

            <strong>{setup.dailyQuestionLimit}</strong>

            <small>問</small>
          </article>

          <article>
            <span>バッファ率</span>

            <strong>{setup.bufferRate}</strong>

            <small>%</small>
          </article>
        </div>

        <div className="exam-summary">
          <div className="summary-row">
            <span>今日の新規</span>

            <strong>{session.newQuestions}</strong>
          </div>

          <div className="summary-row">
            <span>今日の復習</span>

            <strong>{session.reviewQuestions}</strong>
          </div>

          <div className="summary-row">
            <span>今日の合計</span>

            <strong>{session.totalQuestions}</strong>
          </div>
        </div>

        <div className="form-grid">
          <label className="form-item">
            <span>学習カテゴリ</span>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="exam-summary">
          <div className="summary-row">
            <span>対象問題数</span>

            <strong>{filteredQuestions.length}</strong>
          </div>

          <div className="summary-row">
            <span>即答閾値</span>

            <strong>{setup.instantThresholdSeconds}秒</strong>
          </div>
        </div>

        <button
          className="primary-button"
          type="button"
          onClick={() => {
            setSessionStarted(true);
            setQuizStarted(false);
            setQuestionIndex(0);
            setSelectedAnswer(null);
            setShowAnswer(false);
          }}
        >
          学習開始
        </button>

        <button
          className="secondary-button"
          type="button"
          onClick={() => setShowSetup(true)}
        >
          設定変更
        </button>
      </section>
    </main>
  );
}
