import { useState } from 'react'
import './App.css'

type Screen = 'home' | 'quiz'

const sampleQuestion = {
  text: 'PWAでオフライン動作を実現する中心的な仕組みはどれですか？',
  choices: ['Service Worker', 'DOM', 'CSS Grid', 'WebSocket'],
  answerIndex: 0,
  explanation: 'Service Workerがネットワークリクエストを制御し、必要なファイルをキャッシュします。',
}

function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [answered, setAnswered] = useState(false)

  const startQuiz = () => {
    setSelectedIndex(null)
    setAnswered(false)
    setScreen('quiz')
  }

  const answer = () => {
    if (selectedIndex === null) return
    setAnswered(true)
  }

  if (screen === 'quiz') {
    const isCorrect = selectedIndex === sampleQuestion.answerIndex

    return (
      <main className="app-shell">
        <section className="quiz-card" aria-labelledby="question-title">
          <div className="quiz-header">
            <button className="text-button" type="button" onClick={() => setScreen('home')}>
              ホームへ
            </button>
            <span className="progress-label">問題 1 / 1</span>
          </div>

          <p className="eyebrow">PWA基礎</p>
          <h1 id="question-title">{sampleQuestion.text}</h1>

          <div className="choice-list" role="radiogroup" aria-label="回答の選択肢">
            {sampleQuestion.choices.map((choice, index) => {
              const selected = selectedIndex === index
              const resultClass = answered
                ? index === sampleQuestion.answerIndex
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
            <button className="primary-button" type="button" disabled={selectedIndex === null} onClick={answer}>
              回答する
            </button>
          ) : (
            <div className={`result-panel ${isCorrect ? 'result-correct' : 'result-wrong'}`}>
              <strong>{isCorrect ? '正解です' : '不正解です'}</strong>
              <p>{sampleQuestion.explanation}</p>
              <button className="primary-button" type="button" onClick={() => setScreen('home')}>
                学習を終了する
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
        <p className="lead">
          すきま時間に学び、忘れる前に復習する。
          <br />
          端末内で動く勉強用クイズアプリです。
        </p>

        <button className="primary-button large-button" type="button" onClick={startQuiz}>
          学習を開始する
        </button>

        <div className="feature-grid" aria-label="アプリの特徴">
          <article>
            <strong>オフライン</strong>
            <span>通信できない環境でも学習</span>
          </article>
          <article>
            <strong>ローカル保存</strong>
            <span>学習データを端末内に保持</span>
          </article>
          <article>
            <strong>復習対応</strong>
            <span>今後、忘却防止機能を追加</span>
          </article>
        </div>
      </section>
    </main>
  )
}

export default App
