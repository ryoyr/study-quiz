import { useEffect, useMemo, useState, type ReactNode } from 'react';
import './App.css';
import './ui-enhancement.css';
import { questions } from './data/questions';
import AppChrome, { type NavigationSection } from './components/AppChrome';
import DailyMinimumCard from './components/DailyMinimumCard';
import DailyTimeBudgetCard from './components/DailyTimeBudgetCard';
import FeatureLink from './components/FeatureLink';
import FinalReviewCard from './components/FinalReviewCard';
import ForgettingAlertCard from './components/ForgettingAlertCard';
import ProgressForecastCard from './components/ProgressForecastCard';
import SessionPlanDetails from './components/SessionPlanDetails';
import StreakCard from './components/StreakCard';
import StudySourceLauncher from './components/StudySourceLauncher';
import TimeBasedSessionCard from './components/TimeBasedSessionCard';
import AiPromptTemplatesPage from './pages/AiPromptTemplatesPage';
import BackupCenterPage from './pages/BackupCenterPage';
import BatchFactCheckPage from './pages/BatchFactCheckPage';
import CorrectionSuggestionsPage from './pages/CorrectionSuggestionsPage';
import CsvImportPage from './pages/CsvImportPage';
import FavoritesMemoPage from './pages/FavoritesMemoPage';
import InitialSetupPage from './pages/InitialSetupPage';
import LearningHistoryPage from './pages/LearningHistoryPage';
import MistakeNotesPage from './pages/MistakeNotesPage';
import QuestionManagementPage from './pages/QuestionManagementPage';
import ResponseSpeedAnalysisPage from './pages/ResponseSpeedAnalysisPage';
import SettingsPage from './pages/SettingsPage';
import StatisticsPage from './pages/StatisticsPage';
import { loadAiPromptTemplates } from './services/aiPromptTemplateStorage';
import { calculateDailyMinimumProgress } from './services/dailyMinimumService';
import {
  calculateDailyTimeBudget,
  fitQuestionsToTimeBudget,
  loadDailyTimeLimit,
  saveDailyTimeLimit,
} from './services/dailyTimeBudgetService';
import { createFinalReviewPlan } from './services/finalReviewService';
import { detectForgettingCandidates, selectForgettingQuestions } from './services/forgettingDetectionService';
import { scheduleFsrs, type FsrsRating } from './services/fsrsAdapter';
import { loadHistory, saveHistory } from './services/historyStorage';
import { loadMistakeNotes } from './services/mistakeNoteStorage';
import { calculateProgressForecast } from './services/progressForecastService';
import { loadQuestionAnnotations } from './services/questionAnnotationStorage';
import { loadQuestions, saveQuestions } from './services/questionStorage';
import { loadQuestionStates, saveQuestionStates, updateQuestionStates } from './services/questionStateService';
import { generateStudySession } from './services/sessionGenerator';
import { loadCorrectionSuggestions } from './services/correctionSuggestionStorage';
import { completeInitialSetup } from './services/setupFlow';
import { loadSetup, saveSetup } from './services/setupStorage';
import { calculateStudyStreak } from './services/streakService';
import { selectWeakQuestions } from './services/weakQuestionService';
import type { AiPromptTemplate } from './types/AiPromptTemplate';
import type { CorrectionSuggestion } from './types/CorrectionSuggestion';
import type { MistakeNote } from './types/MistakeNote';
import type { Question } from './types/Question';
import type { QuestionAnnotation } from './types/QuestionAnnotation';
import type { QuestionState } from './types/QuestionState';
import { createDefaultSetup, type Setup } from './types/Setup';
import type { StudyHistory } from './types/StudyHistory';
import type { GeneratedStudySession } from './types/StudySession';

type Screen =
  | 'home'
  | 'learn'
  | 'records'
  | 'manage'
  | 'more'
  | 'session'
  | 'quiz'
  | 'statistics'
  | 'setup'
  | 'questions'
  | 'csvImport'
  | 'mistakeNotes'
  | 'annotations'
  | 'corrections'
  | 'history'
  | 'backupCenter'
  | 'aiTemplates'
  | 'speedAnalysis'
  | 'factCheck';

const calculateInstantScore = (responseTimeSeconds: number, thresholdSeconds: number): number =>
  thresholdSeconds <= 0 ? 0 : Math.max(0, 1 - responseTimeSeconds / thresholdSeconds);

const sectionForScreen = (screen: Screen): NavigationSection => {
  if (screen === 'learn' || screen === 'session') return 'learn';
  if (['records', 'statistics', 'history', 'speedAnalysis', 'mistakeNotes'].includes(screen)) return 'records';
  if (['manage', 'questions', 'csvImport', 'annotations', 'corrections', 'factCheck'].includes(screen)) return 'manage';
  if (['more', 'setup', 'backupCenter', 'aiTemplates'].includes(screen)) return 'more';
  return 'home';
};

const forecastLabel = (status: string) => {
  if (status === 'AHEAD') return '計画より先行';
  if (status === 'BEHIND') return '要ペース調整';
  return '計画どおり';
};

export default function App() {
  const [pendingHistory, setPendingHistory] = useState<StudyHistory | null>(null);
  const [dailyTimeLimit, setDailyTimeLimit] = useState(0);
  const [timeBudgetMessage, setTimeBudgetMessage] = useState('');
  const [mistakeNotes, setMistakeNotes] = useState<MistakeNote[]>([]);
  const [annotations, setAnnotations] = useState<QuestionAnnotation[]>([]);
  const [correctionSuggestions, setCorrectionSuggestions] = useState<CorrectionSuggestion[]>([]);
  const [aiPromptTemplates, setAiPromptTemplates] = useState<AiPromptTemplate[]>([]);
  const [correctionQuestionId, setCorrectionQuestionId] = useState('');
  const [requiresInitialSetup, setRequiresInitialSetup] = useState(false);
  const [screen, setScreen] = useState<Screen>('home');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [questionStates, setQuestionStates] = useState<QuestionState[]>([]);
  const [generatedSession, setGeneratedSession] = useState<GeneratedStudySession | null>(null);
  const [storedQuestions, setStoredQuestions] = useState<Question[]>(questions);
  const [setup, setSetup] = useState<Setup>(createDefaultSetup());
  const [history, setHistory] = useState<StudyHistory[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [activeQuestions, setActiveQuestions] = useState<Question[]>(questions);
  const [weakMessage, setWeakMessage] = useState('');
  const [questionShownAt, setQuestionShownAt] = useState<number | null>(null);
  const [currentResponseTime, setCurrentResponseTime] = useState(0);
  const [currentInstantScore, setCurrentInstantScore] = useState(0);

  useEffect(() => {
    const saved = loadSetup();
    if (saved) {
      setSetup(saved);
      setRequiresInitialSetup(saved.setupCompleted !== true);
    } else {
      setRequiresInitialSetup(true);
    }
    const loadedHistory = loadHistory();
    setHistory(loadedHistory);
    setMistakeNotes(loadMistakeNotes());
    setAnnotations(loadQuestionAnnotations());
    setCorrectionSuggestions(loadCorrectionSuggestions());
    setAiPromptTemplates(loadAiPromptTemplates());
    setDailyTimeLimit(loadDailyTimeLimit());
    setQuestionStates(loadQuestionStates(loadedHistory));
    setStoredQuestions(loadQuestions());
    setLoaded(true);
  }, []);

  const categories = useMemo(
    () => ['ALL', ...new Set(storedQuestions.map((question) => question.category))],
    [storedQuestions],
  );
  const filteredQuestions = useMemo(
    () => selectedCategory === 'ALL' ? storedQuestions : storedQuestions.filter((question) => question.category === selectedCategory),
    [selectedCategory, storedQuestions],
  );
  const sessionPreview = useMemo(
    () => generateStudySession(filteredQuestions, history, setup, questionStates),
    [filteredQuestions, history, setup, questionStates],
  );
  const remainingDays = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exam = new Date(setup.examDate);
    exam.setHours(0, 0, 0, 0);
    return Math.ceil((exam.getTime() - today.getTime()) / 86400000);
  }, [setup.examDate]);
  const progressForecast = useMemo(
    () => calculateProgressForecast(
      storedQuestions,
      history,
      questionStates,
      sessionPreview.remainingNewQuestions,
      sessionPreview.effectiveDays,
      setup.bufferRate,
    ),
    [storedQuestions, history, questionStates, sessionPreview.remainingNewQuestions, sessionPreview.effectiveDays, setup.bufferRate],
  );
  const dailyMinimumProgress = useMemo(
    () => calculateDailyMinimumProgress(history, setup.dailyMinimumQuestions),
    [history, setup.dailyMinimumQuestions],
  );
  const forgettingCandidates = useMemo(
    () => detectForgettingCandidates(storedQuestions, history),
    [storedQuestions, history],
  );
  const studyStreak = useMemo(
    () => calculateStudyStreak(history, setup.reservedDates),
    [history, setup.reservedDates],
  );
  const finalReviewPlan = useMemo(
    () => createFinalReviewPlan(
      storedQuestions,
      history,
      questionStates,
      remainingDays,
      Math.min(20, setup.dailyQuestionLimit),
    ),
    [storedQuestions, history, questionStates, remainingDays, setup.dailyQuestionLimit],
  );
  const dailyTimeBudget = useMemo(
    () => calculateDailyTimeBudget(history, dailyTimeLimit),
    [history, dailyTimeLimit],
  );

  const masteredCount = questionStates.filter((state) => state.masteryLevel === 'MASTERED').length;
  const learningCount = questionStates.filter((state) => state.masteryLevel === 'LEARNING').length;
  const unlearnedCount = Math.max(0, storedQuestions.length - masteredCount - learningCount);
  const correctCount = history.filter((item) => item.correct).length;
  const accuracy = history.length ? Math.round(correctCount / history.length * 100) : 0;
  const masteryRate = storedQuestions.length ? Math.round(masteredCount / storedQuestions.length * 100) : 0;

  const startQuestionTimer = () => setQuestionShownAt(performance.now());
  const resetQuestionState = () => {
    setSelectedAnswer(null);
    setShowAnswer(false);
    setCurrentResponseTime(0);
    setCurrentInstantScore(0);
    setTimeout(startQuestionTimer, 0);
  };
  const beginQuiz = (targets: Question[]) => {
    if (targets.length === 0) return;
    const fitted = fitQuestionsToTimeBudget(targets, dailyTimeBudget);
    if (fitted.length === 0) {
      setTimeBudgetMessage('本日の学習時間上限に到達しています。上限を変更するか、翌日に再開してください。');
      return;
    }
    setTimeBudgetMessage(fitted.length < targets.length ? `残り時間に合わせて ${fitted.length}問へ調整しました。` : '');
    setActiveQuestions(fitted);
    setQuestionIndex(0);
    setWeakMessage('');
    setScreen('quiz');
    resetQuestionState();
  };
  const beginWeakQuiz = () => {
    const targets = selectWeakQuestions(storedQuestions, history, setup.dailyQuestionLimit);
    if (targets.length === 0) {
      setWeakMessage('苦手問題の判定対象がありません。問題へ回答するか、現在の履歴では弱点基準に該当していません。');
      return;
    }
    beginQuiz(targets);
  };
  const beginForgettingQuiz = () => {
    const targets = selectForgettingQuestions(storedQuestions, history, setup.dailyQuestionLimit);
    if (targets.length > 0) beginQuiz(targets);
  };
  const beginFinalReview = () => {
    if (finalReviewPlan.questions.length > 0) beginQuiz(finalReviewPlan.questions);
  };
  const answerQuestion = () => {
    if (selectedAnswer === null || showAnswer) return;
    const question = activeQuestions[questionIndex];
    const elapsed = Math.max(0, (performance.now() - (questionShownAt ?? performance.now())) / 1000);
    const responseTimeSeconds = Math.round(elapsed * 10) / 10;
    const instantScore = Math.round(calculateInstantScore(responseTimeSeconds, setup.instantThresholdSeconds) * 1000) / 1000;
    const item: StudyHistory = {
      id: crypto.randomUUID(),
      questionId: question.id,
      category: question.category,
      selectedIndex: selectedAnswer,
      correct: selectedAnswer === question.answerIndex,
      answeredAt: new Date().toISOString(),
      responseTimeSeconds,
      instantScore,
    };
    setPendingHistory(item);
    setCurrentResponseTime(responseTimeSeconds);
    setCurrentInstantScore(instantScore);
    setShowAnswer(true);
  };
  const applyFsrsRating = (rating: FsrsRating) => {
    if (!pendingHistory) return;
    const previous = questionStates.find((state) => state.questionId === pendingHistory.questionId);
    const fsrsCard = scheduleFsrs(previous?.fsrsCard ?? null, rating, new Date(pendingHistory.answeredAt));
    const item: StudyHistory = { ...pendingHistory, fsrsRating: rating };
    const updated = [item, ...history];
    setHistory(updated);
    saveHistory(updated);
    let updatedStates = updateQuestionStates(questionStates, item);
    updatedStates = updatedStates.map((state) => state.questionId === item.questionId ? {
      ...state,
      fsrsCard,
      nextReviewAt: fsrsCard.due,
      fsrsStability: fsrsCard.stability,
      fsrsDifficulty: fsrsCard.difficulty,
    } : state);
    setQuestionStates(updatedStates);
    saveQuestionStates(updatedStates);
    setPendingHistory(null);
    if (questionIndex + 1 < activeQuestions.length) {
      setQuestionIndex((value) => value + 1);
      resetQuestionState();
    } else {
      setQuestionIndex(0);
      setScreen('home');
      setSelectedAnswer(null);
      setShowAnswer(false);
    }
  };

  const navigate = (section: NavigationSection) => {
    setCorrectionQuestionId('');
    setScreen(section);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const withChrome = (content: ReactNode) => (
    <AppChrome
      active={sectionForScreen(screen)}
      onNavigate={navigate}
      remainingDays={remainingDays}
      completedToday={dailyMinimumProgress.completed}
      dailyMinimum={dailyMinimumProgress.minimum}
      streakDays={studyStreak.currentDays}
    >
      {content}
    </AppChrome>
  );

  if (!loaded) {
    return <main className="app-shell"><section className="home-card"><h1>Loading...</h1></section></main>;
  }
  if (requiresInitialSetup) {
    return (
      <InitialSetupPage
        setup={setup}
        onSave={(next) => {
          const completed = completeInitialSetup(next);
          setSetup(completed);
          setRequiresInitialSetup(false);
          setScreen('home');
        }}
      />
    );
  }

  if (screen === 'csvImport') {
    return withChrome(
      <CsvImportPage
        existingQuestions={storedQuestions}
        onImport={(items) => {
          const updated = [...storedQuestions, ...items];
          setStoredQuestions(updated);
          saveQuestions(updated);
        }}
        onBack={() => setScreen('questions')}
      />,
    );
  }
  if (screen === 'questions') {
    return withChrome(
      <QuestionManagementPage
        questions={storedQuestions}
        questionStates={questionStates}
        onChange={(items) => {
          setStoredQuestions(items);
          saveQuestions(items);
          if (!items.some((question) => question.category === selectedCategory)) setSelectedCategory('ALL');
        }}
        onImport={() => setScreen('csvImport')}
        onBack={() => setScreen('manage')}
      />,
    );
  }
  if (screen === 'factCheck') {
    return withChrome(
      <BatchFactCheckPage
        questions={storedQuestions}
        suggestions={correctionSuggestions}
        onSuggestionsChange={setCorrectionSuggestions}
        onBack={() => setScreen('manage')}
      />,
    );
  }
  if (screen === 'speedAnalysis') {
    return withChrome(
      <ResponseSpeedAnalysisPage
        questions={storedQuestions}
        history={history}
        limit={setup.dailyQuestionLimit}
        onStart={beginQuiz}
        onBack={() => setScreen('records')}
      />,
    );
  }
  if (screen === 'aiTemplates') {
    return withChrome(
      <AiPromptTemplatesPage
        questions={storedQuestions}
        items={aiPromptTemplates}
        onChange={setAiPromptTemplates}
        onBack={() => setScreen('more')}
      />,
    );
  }
  if (screen === 'backupCenter') {
    return withChrome(<BackupCenterPage onBack={() => setScreen('more')} />);
  }
  if (screen === 'history') {
    return withChrome(
      <LearningHistoryPage history={history} questions={storedQuestions} onBack={() => setScreen('records')} />,
    );
  }
  if (screen === 'corrections') {
    return withChrome(
      <CorrectionSuggestionsPage
        questions={storedQuestions}
        items={correctionSuggestions}
        initialQuestionId={correctionQuestionId}
        onChange={setCorrectionSuggestions}
        onBack={() => {
          setCorrectionQuestionId('');
          setScreen('manage');
        }}
      />,
    );
  }
  if (screen === 'annotations') {
    return withChrome(
      <FavoritesMemoPage
        questions={storedQuestions}
        annotations={annotations}
        onChange={setAnnotations}
        onStart={beginQuiz}
        onBack={() => setScreen('manage')}
      />,
    );
  }
  if (screen === 'mistakeNotes') {
    return withChrome(
      <MistakeNotesPage
        questions={storedQuestions}
        history={history}
        notes={mistakeNotes}
        onChange={setMistakeNotes}
        onStart={beginQuiz}
        onBack={() => setScreen('records')}
      />,
    );
  }
  if (screen === 'statistics') {
    return withChrome(
      <StatisticsPage
        history={history}
        questionStates={questionStates}
        questions={storedQuestions}
        instantThresholdSeconds={setup.instantThresholdSeconds}
        onBack={() => setScreen('records')}
      />,
    );
  }
  if (screen === 'setup') {
    return withChrome(
      <SettingsPage
        setup={setup}
        history={history}
        questionStates={questionStates}
        onSave={(next) => {
          const completed = { ...next, setupCompleted: true };
          setSetup(completed);
          saveSetup(completed);
          setRequiresInitialSetup(false);
          setScreen('more');
        }}
        onRestore={(nextSetup, nextHistory, nextStates) => {
          const restored = { ...nextSetup, setupCompleted: true };
          setSetup(restored);
          setHistory(nextHistory);
          saveSetup(restored);
          saveHistory(nextHistory);
          setQuestionStates(nextStates);
          saveQuestionStates(nextStates);
        }}
        onCancel={() => setScreen('more')}
      />,
    );
  }
  if (screen === 'session') {
    const session = generatedSession ?? sessionPreview;
    return withChrome(
      <main className="app-shell">
        <section className="home-card">
          <p className="eyebrow">SESSION</p>
          <h1>学習セッション</h1>
          <div className="exam-summary">
            <div className="summary-row"><span>カテゴリ</span><strong>{selectedCategory}</strong></div>
            <div className="summary-row"><span>対象問題数</span><strong>{session.totalCount}</strong></div>
            <div className="summary-row"><span>推定時間</span><strong>{session.estimatedMinutes}分</strong></div>
            <div className="summary-row"><span>新規 / 復習 / 弱点</span><strong>{session.newCount} / {session.reviewCount} / {session.weakCount}問</strong></div>
          </div>
          <SessionPlanDetails items={session.items} />
          <button className="primary-button" type="button" onClick={() => beginQuiz(session.items.map((item) => item.question))} disabled={session.totalCount === 0}>学習開始</button>
          <button className="secondary-button" type="button" onClick={() => setScreen('learn')}>学習メニューへ戻る</button>
        </section>
      </main>,
    );
  }
  if (screen === 'quiz') {
    const question = activeQuestions[questionIndex];
    if (!question) return null;
    return (
      <main className="app-shell quiz-shell">
        <section className="home-card quiz-card">
          <div className="quiz-progress">{questionIndex + 1} / {activeQuestions.length}</div>
          <p className="eyebrow">{question.category}</p>
          <h1 className="question-title">{question.text}</h1>
          <div className="form-grid">
            {question.choices.map((choice, index) => {
              const selected = selectedAnswer === index;
              let className = 'secondary-button choice-button';
              if (!showAnswer && selected) className += ' choice-selected';
              if (showAnswer && index === question.answerIndex) className += ' choice-correct';
              if (showAnswer && selected && index !== question.answerIndex) className += ' choice-wrong';
              return <button key={choice} className={className} type="button" disabled={showAnswer} onClick={() => setSelectedAnswer(index)}>{choice}</button>;
            })}
          </div>
          {selectedAnswer !== null && !showAnswer && <button className="primary-button" type="button" onClick={answerQuestion}>回答する</button>}
          {showAnswer && (
            <>
              <div className="exam-summary">
                <div className="summary-row"><span>判定</span><strong>{selectedAnswer === question.answerIndex ? '正解' : '不正解'}</strong></div>
                <div className="summary-row"><span>回答時間</span><strong>{currentResponseTime.toFixed(1)}秒</strong></div>
                <div className="summary-row"><span>即答スコア</span><strong>{Math.round(currentInstantScore * 100)}%</strong></div>
                <div className="explanation-row"><span>解説</span><p>{question.explanation}</p></div>
              </div>
              <button className="correction-open-button" type="button" onClick={() => { setCorrectionQuestionId(question.id); setScreen('corrections'); }}>問題の修正を提案</button>
              <div className="fsrs-rating">
                <p>記憶の状態を選択してください</p>
                <div className="fsrs-rating-grid">
                  <button className="rating-again" type="button" onClick={() => applyFsrsRating('AGAIN')}>Again<small>忘れた</small></button>
                  <button className="rating-hard" type="button" onClick={() => applyFsrsRating('HARD')}>Hard<small>難しい</small></button>
                  <button className="rating-good" type="button" onClick={() => applyFsrsRating('GOOD')}>Good<small>思い出せた</small></button>
                  <button className="rating-easy" type="button" onClick={() => applyFsrsRating('EASY')}>Easy<small>簡単</small></button>
                </div>
              </div>
            </>
          )}
        </section>
      </main>
    );
  }

  if (screen === 'learn') {
    return withChrome(
      <main className="app-shell">
        <section className="home-card feature-hub-card">
          <div className="hub-heading">
            <p className="eyebrow">STUDY</p>
            <h1>学習</h1>
            <p>今日の計画、学習種別、使える時間から開始方法を選べます。</p>
          </div>
          <section className="hub-section">
            <h2>今日の学習計画</h2>
            <div className="compact-plan-grid">
              <article><span>新規</span><strong>{sessionPreview.newCount}</strong><small>問</small></article>
              <article><span>復習</span><strong>{sessionPreview.reviewCount}</strong><small>問</small></article>
              <article><span>弱点</span><strong>{sessionPreview.weakCount}</strong><small>問</small></article>
              <article className="is-total"><span>合計</span><strong>{sessionPreview.totalCount}</strong><small>問</small></article>
            </div>
            <label className="form-item compact-category-select">
              <span>学習カテゴリ</span>
              <select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}>
                {categories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>
            <button className="primary-button" type="button" onClick={() => { setGeneratedSession(sessionPreview); setScreen('session'); }}>学習計画を確認して開始</button>
            <StudySourceLauncher items={sessionPreview.items} onStart={beginQuiz} />
          </section>
          <section className="hub-section">
            <h2>ペースと学習モード</h2>
            <DailyMinimumCard progress={dailyMinimumProgress} />
            <DailyTimeBudgetCard budget={dailyTimeBudget} onSave={(minutes) => setDailyTimeLimit(saveDailyTimeLimit(minutes))} />
            {timeBudgetMessage && <div className="time-budget-message">{timeBudgetMessage}</div>}
            <TimeBasedSessionCard items={sessionPreview.items} onStart={beginQuiz} />
            <ForgettingAlertCard candidates={forgettingCandidates} onStart={beginForgettingQuiz} />
            <FinalReviewCard plan={finalReviewPlan} remainingDays={remainingDays} onStart={beginFinalReview} />
            <button className="weak-button" type="button" onClick={beginWeakQuiz}>苦手問題だけ学習</button>
            {weakMessage && <div className="weak-message">{weakMessage}</div>}
          </section>
        </section>
      </main>,
    );
  }

  if (screen === 'records') {
    return withChrome(
      <main className="app-shell">
        <section className="home-card feature-hub-card">
          <div className="hub-heading">
            <p className="eyebrow">RECORDS</p>
            <h1>記録・分析</h1>
            <p>学習結果と弱点を確認し、次に取り組む内容を判断します。</p>
          </div>
          <div className="stats-grid records-summary">
            <article><span>回答数</span><strong>{history.length}</strong><small>問</small></article>
            <article><span>正答率</span><strong>{accuracy}</strong><small>%</small></article>
            <article><span>習得済み</span><strong>{masteredCount}</strong><small>問</small></article>
          </div>
          <div className="feature-link-list">
            <FeatureLink icon="▥" title="統計" description="期間・分野別の成績と定着度" badge={`${accuracy}%`} onClick={() => setScreen('statistics')} />
            <FeatureLink icon="↺" title="学習履歴" description="回答結果、時間、FSRS評価を確認" badge={`${history.length}件`} tone="green" onClick={() => setScreen('history')} />
            <FeatureLink icon="◷" title="回答速度分析" description="速度悪化と即答スコアを分析" tone="amber" onClick={() => setScreen('speedAnalysis')} />
            <FeatureLink icon="!" title="間違いノート" description="誤答原因と正しい知識を整理" badge={`${mistakeNotes.length}件`} tone="violet" onClick={() => setScreen('mistakeNotes')} />
          </div>
          <ProgressForecastCard forecast={progressForecast} />
          <StreakCard streak={studyStreak} />
        </section>
      </main>,
    );
  }

  if (screen === 'manage') {
    const favoriteCount = annotations.filter((item) => item.favorite).length;
    const pendingCorrections = correctionSuggestions.filter((item) => item.status === 'pending').length;
    return withChrome(
      <main className="app-shell">
        <section className="home-card feature-hub-card">
          <div className="hub-heading">
            <p className="eyebrow">MANAGE</p>
            <h1>問題・教材管理</h1>
            <p>問題データ、メモ、品質確認をこの画面にまとめました。</p>
          </div>
          <div className="feature-link-list">
            <FeatureLink icon="▦" title="問題管理" description="検索、登録、編集、削除、CSV取込" badge={`${storedQuestions.length}問`} onClick={() => setScreen('questions')} />
            <FeatureLink icon="★" title="お気に入り・メモ" description="重要な問題と個人メモを管理" badge={`${favoriteCount}件`} tone="amber" onClick={() => setScreen('annotations')} />
            <FeatureLink icon="✎" title="問題修正提案" description="問題を直接変更せず修正案を管理" badge={pendingCorrections > 0 ? `未確認 ${pendingCorrections}` : undefined} tone="violet" onClick={() => { setCorrectionQuestionId(''); setScreen('corrections'); }} />
            <FeatureLink icon="✓" title="一括ファクトチェック" description="複数問題の確認結果を取り込む" tone="green" onClick={() => setScreen('factCheck')} />
          </div>
        </section>
      </main>,
    );
  }

  if (screen === 'more') {
    return withChrome(
      <main className="app-shell">
        <section className="home-card feature-hub-card">
          <div className="hub-heading">
            <p className="eyebrow">MORE</p>
            <h1>その他</h1>
            <p>アプリ設定、データ保全、補助ツールを管理します。</p>
          </div>
          <div className="feature-link-list">
            <FeatureLink icon="⚙" title="設定" description="試験日、上限、予約日、判定条件" tone="slate" onClick={() => setScreen('setup')} />
            <FeatureLink icon="⇩" title="完全バックアップ" description="全データの出力と復元" tone="green" onClick={() => setScreen('backupCenter')} />
            <FeatureLink icon="AI" title="AI質問テンプレート" description="問題コンテキスト付きプロンプトを生成" tone="violet" onClick={() => setScreen('aiTemplates')} />
          </div>
          <section className="app-info-panel" aria-label="アプリ情報">
            <div><span>保存先</span><strong>この端末内</strong></div>
            <div><span>利用形態</span><strong>PWA・オフライン対応</strong></div>
            <p>学習データはV1では端末外へ送信しません。更新がある場合は画面下部に通知します。</p>
          </section>
        </section>
      </main>,
    );
  }

  return withChrome(
    <main className="app-shell dashboard-shell">
      <section className="home-card dashboard-card">
        <div className="dashboard-heading">
          <div className="brand-mark compact-brand">Q</div>
          <div>
            <p className="eyebrow">TODAY</p>
            <h1>{setup.name}</h1>
            <p>{setup.examDate} ・ {remainingDays > 0 ? `あと${remainingDays}日` : remainingDays === 0 ? '試験当日' : '試験日経過'}</p>
          </div>
        </div>

        <section className="today-action-card">
          <div className="today-action-heading">
            <div><span>今日の学習</span><strong>{sessionPreview.totalCount}問</strong></div>
            <b>{sessionPreview.estimatedMinutes}分目安</b>
          </div>
          <div className="today-counts" aria-label="今日の出題内訳">
            <span>新規 <strong>{sessionPreview.newCount}</strong></span>
            <span>復習 <strong>{sessionPreview.reviewCount}</strong></span>
            <span>弱点 <strong>{sessionPreview.weakCount}</strong></span>
          </div>
          <button className="primary-button large-button" type="button" onClick={() => { setGeneratedSession(sessionPreview); setScreen('session'); }}>今日の学習を開始</button>
          <button className="inline-link-button" type="button" onClick={() => setScreen('learn')}>学習メニューと別モードを見る</button>
        </section>

        <section className="home-overview" aria-label="本日の状況">
          <article className={dailyMinimumProgress.achieved ? 'is-good' : ''}>
            <span>最低ライン</span>
            <strong>{dailyMinimumProgress.completed}/{dailyMinimumProgress.minimum}問</strong>
            <small>{dailyMinimumProgress.achieved ? '達成済み' : `あと${dailyMinimumProgress.remaining}問`}</small>
          </article>
          <article>
            <span>連続学習</span>
            <strong>{studyStreak.currentDays}日</strong>
            <small>{studyStreak.studiedToday ? '本日学習済み' : '本日未学習'}</small>
          </article>
          <article className={progressForecast.status === 'BEHIND' ? 'is-warning' : 'is-good'}>
            <span>進捗予測</span>
            <strong>{forecastLabel(progressForecast.status)}</strong>
            <small>直近7日から判定</small>
          </article>
          <article>
            <span>定着状況</span>
            <strong>{masteredCount}問</strong>
            <small>学習中 {learningCount}・未学習 {unlearnedCount}</small>
          </article>
        </section>

        <section className="home-activity-card" aria-label="これまでの学習状況">
          <div className="home-activity-heading">
            <div>
              <span>これまでの学習</span>
              <strong>定着度 {masteryRate}%</strong>
            </div>
            <button type="button" onClick={() => setScreen('records')}>詳しく見る ›</button>
          </div>
          <div className="home-activity-track" aria-hidden="true">
            <div style={{ width: `${masteryRate}%` }} />
          </div>
          <div className="home-activity-metrics">
            <span>回答数 <strong>{history.length}問</strong></span>
            <span>正答率 <strong>{accuracy}%</strong></span>
            <span>習得済み <strong>{masteredCount}問</strong></span>
          </div>
        </section>

        {forgettingCandidates.length > 0 && (
          <button className="home-alert" type="button" onClick={() => setScreen('learn')}>
            <span>忘れかけ候補が {forgettingCandidates.length}問あります</span>
            <strong>学習画面で確認 ›</strong>
          </button>
        )}
      </section>
    </main>,
  );
}
