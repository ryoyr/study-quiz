import { useMemo, useState } from 'react'
import './App.css'
import { questions } from './data/questions'
import type { Question } from './types/Question'

type Screen = 'home' | 'quiz' | 'result'

type AnswerResult = {
  questionId: string
  selectedIndex: number
  correct: boolean
}

const shuffle = <T,>(items: T[]): T[] => {
  const copied = [...items]
  for (let index = copied.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    ;[copied[index], copied[randomIndex]] = [copied[randomIndex], copied[index]]
  }
  return copied
}

function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [sessionQuestions, setSessionQuestions] = useState<Question[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [answered, setAnswered] = useState(false)
  const [results, setResults] = useState<AnswerResult[]>([])

  const currentQuestion = sessionQuestions[currentIndex]
  const correctCount = useMemo(() => results.filter((result) => result.correct).length, [results])

  const startQuiz = () => {
    setSessionQuestions(shuffle(questions))
    setCurrentIndex(0)
    setSelectedIndex(null)
    setAnswered(false)
    setResults([])
    setScreen('quiz')
  }

  const submitAnswer = () => {
    if (selectedIndex === null || !currentQuestion) return
    const correct = selectedIndex === currentQuestion.answerIndex
    setResults((current) => [
      ...current,
      { questionId: currentQuestion.id, selectedIndex, correct },
    ])
    setAnswered(true)
  }

  const nextQuestion = () => {
    if (currentIndex + 1 >= sessionQuestions.length) {
      setScreen('result')
      return
    }
    setCurrentIndex((index) => index + 1)
    setSelectedIndex(null)
    setAnswered(false)
  }

  if (screen === 'result') {
    const percentage = Math.round((correctCount / sessionQuestions.length) * 100)
    return (
      <main className="app-shell">
        <section className="home-card result-card" aria-labelledby="result-title">
          <p className="eyebrow">SESSION COMPLETE</p>
          <h1 id="result-title">学習結果</h1>
          <div className="score-circle" aria-label={`正答率 ${percentage}%`}>
            <strong>{percentage}%</strong>
            <span>{correctCount} / {sessionQuestions.length}問正解</span>
          </div>
          <p className="lead">学習おつかれさまでした。もう一度実行すると、問題順がランダムに変わります。</p>
          <button className="primary-button large-button" type="button" onClick={startQuiz}>もう一度学習する</button>
          <button className="secondary-button" type="button" onClick={() => setScreen('home')}>ホームへ戻る</button>
        </section>
      </main>
    )
  }

  if (screen === 'quiz' && currentQuestion) {
    const isCorrect = selectedIndex === currentQuestion.answerIndex
    const progress = ((currentIndex + 1) / sessionQuestions.length) * 100

    return (
      <main className="app-shell">
        <section className="quiz-card" aria-labelledby="question-title">
          <div className="quiz-header">
            <button className="text-button" type="button" onClick={() => setScreen('home')}>中断する</button>
            <span className="progress-label">問題 {currentIndex + 1} / {sessionQuestions.length}</span>
          </div>
          <div className="progress-track" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
          <p className="eyebrow">{currentQuestion.category}</p>
          <h1 id="question-title">{currentQuestion.text}</h1>

          <div className="choice-list" role="radiogroup" aria-label="回答の選択肢">
            {currentQuestion.choices.map((choice, index) => {
              const selected = selectedIndex === index
              const resultClass = answered
                ? index === currentQuestion.answerIndex
                  ? 'choice-correct'
                  : selected
                    ? 'choice-wrong'
                    : ''
                : ''
              return (
                <button
                  className={`choice-button ${selected ? 'choice-selected' : ''} ${resultClass}`}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={answered}
                  key={choice}
                  onClick={() => setSelectedIndex(index)}
                >
                  <span className="choice-index">{String.fromCharCode(65 + index)}</span>
                  <span>{choice}</span>
                </button>
              )
            })}
          </div>

          {!answered ? (
            <button className="primary-button" type="button" disabled={selectedIndex === null} onClick={submitAnswer}>回答する</button>
          ) : (
            <div className={`result-panel ${isCorrect ? 'result-correct' : 'result-wrong'}`}>
              <strong>{isCorrect ? '正解です' : '不正解です'}</strong>
              <p>{currentQuestion.explanation}</p>
              <button className="primary-button" type="button" onClick={nextQuestion}>
                {currentIndex + 1 === sessionQuestions.length ? '結果を見る' : '次の問題へ'}
              </button>
            </div>
          )}
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <section className="home-card" aria-labelledby="app-title">
        <div className="brand-mark" aria-hidden="true">Q</div>
        <p className="eyebrow">LOCAL FIRST LEARNING</p>
        <h1 id="app-title">Study Quiz</h1>
        <p className="lead">すきま時間に学び、忘れる前に復習する。<br />端末内で動く勉強用クイズアプリです。</p>
        <button className="primary-button large-button" type="button" onClick={startQuiz}>{questions.length}問の学習を開始する</button>
        <div className="feature-grid" aria-label="アプリの特徴">
          <article><strong>ランダム出題</strong><span>学習開始ごとに問題順を変更</span></article>
          <article><strong>進捗表示</strong><span>現在の問題数と進捗を確認</span></article>
          <article><strong>結果確認</strong><span>終了時に正答率を表示</span></article>
        </div>
      </section>
    </main>
  )
}

export default App
