import { useState } from "react";

import type { Question } from "../types/Question";

type Props = {
  questions: Question[];

  onFinish: (
    correctCount: number,
  ) => void;
};

export default function QuizPage({
  questions,
  onFinish,
}: Props) {
  const [currentIndex, setCurrentIndex] =
    useState(0);

  const [selected, setSelected] =
    useState<number | null>(null);

  const [correctCount, setCorrectCount] =
    useState(0);

  const currentQuestion =
    questions[currentIndex];

  const answer = () => {
    if (selected === null) {
      return;
    }

    const isCorrect =
      selected ===
      currentQuestion.answerIndex;

    const nextCorrectCount =
      isCorrect
        ? correctCount + 1
        : correctCount;

    setCorrectCount(
      nextCorrectCount,
    );

    if (
      currentIndex ===
      questions.length - 1
    ) {
      onFinish(
        nextCorrectCount,
      );

      return;
    }

    setCurrentIndex(
      currentIndex + 1,
    );

    setSelected(null);
  };

  return (
    <main className="app-shell">
      <section className="home-card">

        <p className="eyebrow">
          QUESTION
        </p>

        <h1>
          {currentQuestion.text}
        </h1>

        <div className="form-grid">

          {currentQuestion.choices.map(
            (choice, index) => (
              <button
                key={index}
                className={
                  selected === index
                    ? "primary-button"
                    : "secondary-button"
                }
                onClick={() =>
                  setSelected(
                    index,
                  )
                }
              >
                {choice}
              </button>
            ),
          )}

        </div>

        <button
          className="primary-button"
          onClick={answer}
        >
          回答する
        </button>

      </section>
    </main>
  );
}