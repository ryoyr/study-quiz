
import { useEffect, useMemo, useState, type ReactNode } from "react";
import "./App.css";
import { questions } from "./data/questions";
import { defaultExamScopes } from "./data/examScopes";
import AppChrome, { type NavigationSection } from "./components/AppChrome";
import AppIcon from "./components/AppIcon";
import AiQuestionPanel from "./components/AiQuestionPanel";
import DailyMinimumCard from "./components/DailyMinimumCard";
import DailyTimeBudgetCard from "./components/DailyTimeBudgetCard";
import FeatureLink from "./components/FeatureLink";
import FinalReviewCard from "./components/FinalReviewCard";
import ForgettingAlertCard from "./components/ForgettingAlertCard";
import ProgressForecastCard from "./components/ProgressForecastCard";
import SessionPlanDetails from "./components/SessionPlanDetails";
import StreakCard from "./components/StreakCard";
import StudySourceLauncher from "./components/StudySourceLauncher";
import StudyFilterPanel from "./components/StudyFilterPanel";
import LearningProgressCharts from "./components/LearningProgressCharts";
import TimeBasedSessionCard from "./components/TimeBasedSessionCard";
import AiPromptTemplatesPage from "./pages/AiPromptTemplatesPage";
import BackupCenterPage from "./pages/BackupCenterPage";
import BatchFactCheckPage from "./pages/BatchFactCheckPage";
import CorrectionSuggestionsPage from "./pages/CorrectionSuggestionsPage";
import CsvImportPage from "./pages/CsvImportPage";
import FavoritesMemoPage from "./pages/FavoritesMemoPage";
import InitialSetupPage from "./pages/InitialSetupPage";
import LearningHistoryPage from "./pages/LearningHistoryPage";
import MistakeNotesPage from "./pages/MistakeNotesPage";
import QuestionManagementPage from "./pages/QuestionManagementPage";
import SimilarQuestionGeneratorPage from "./pages/SimilarQuestionGeneratorPage";
import ResponseSpeedAnalysisPage from "./pages/ResponseSpeedAnalysisPage";
import ResultPage from "./pages/ResultPage";
import SettingsPage from "./pages/SettingsPage";
import StatisticsPage from "./pages/StatisticsPage";
import {
  loadAiPromptTemplates,
  saveAiPromptTemplates,
} from "./services/aiPromptTemplateStorage";
import {
  clearActiveSession,
  loadActiveSession,
  reconcileActiveSessionSnapshot,
  saveActiveSession,
  type ActiveSessionSnapshot,
} from "./services/activeSessionStorage";
import { calculateDailyMinimumProgress } from "./services/dailyMinimumService";
import {
  calculateDailyTimeBudget,
  fitQuestionsToTimeBudget,
  loadDailyTimeLimit,
  saveDailyTimeLimit,
} from "./services/dailyTimeBudgetService";
import { createFinalReviewPlan } from "./services/finalReviewService";
import {
  detectForgettingCandidates,
  selectForgettingQuestions,
} from "./services/forgettingDetectionService";
import { scheduleFsrs, type FsrsRating } from "./services/fsrsAdapter";
import { loadHistory } from "./services/historyStorage";
import { saveLearningProgress } from "./services/learningProgressStorage";
import {
  loadMistakeNotes,
  saveMistakeNotes,
} from "./services/mistakeNoteStorage";
import { calculateProgressForecast } from "./services/progressForecastService";
import {
  loadQuestionAnnotations,
  saveQuestionAnnotations,
} from "./services/questionAnnotationStorage";
import { loadQuestions, saveQuestions } from "./services/questionStorage";
import {
  loadQuestionStates,
  updateQuestionStates,
} from "./services/questionStateService";
import {
  generateSelectedStudySession,
  selectionFromSetup,
  type StudySelection,
} from "./services/studySelectionService";
import { normalizeStudyCategories, studyRangeLabel } from "./services/studyRangeService";
import {
  masteryFiltersLabel,
  normalizeMasteryFilters,
  questionModesLabel,
} from "./services/studyOptionService";
import { applyTheme, colorModeLabel, visualThemeLabel } from "./services/themeService";
import {
  loadCorrectionSuggestions,
  saveCorrectionSuggestions,
} from "./services/correctionSuggestionStorage";
import {
  getRemainingDays,
  loadSetup,
  saveSetup,
} from "./services/setupStorage";
import { recoverStorageTransaction } from "./services/storageTransaction";
import { migrateLegacyStorage } from "./services/storageMigration";
import {
  findSetup,
  persistSetup,
} from "./infrastructure/repositories/setupRepository";
import { readExamScopes } from "./infrastructure/db/database";
import { SaveInitialSetupUseCase } from "./application/setup/SaveInitialSetupUseCase";
import { calculateStudyStreak } from "./services/streakService";
import { getEffectiveReservedDates } from "./services/reservedDayService";
import { selectWeakQuestions } from "./services/weakQuestionService";
import type { AiPromptTemplate } from "./types/AiPromptTemplate";
import type { CorrectionSuggestion } from "./types/CorrectionSuggestion";
import type { ExamScope } from "./types/ExamScope";
import type { MistakeNote } from "./types/MistakeNote";
import type { Question } from "./types/Question";
import type { QuestionAnnotation } from "./types/QuestionAnnotation";
import type { QuestionState } from "./types/QuestionState";
import { createDefaultSetup, type Setup } from "./types/Setup";
import type { StudyHistory } from "./types/StudyHistory";
import type { GeneratedStudySession } from "./types/StudySession";

type Screen =
  | "home"
  | "learn"
  | "records"
  | "manage"
  | "more"
  | "session"
  | "quiz"
  | "result"
  | "statistics"
  | "setup"
  | "questions"
  | "csvImport"
  | "mistakeNotes"
  | "annotations"
  | "corrections"
  | "history"
  | "backupCenter"
  | "aiTemplates"
  | "speedAnalysis"
  | "factCheck"
  | "similarQuestion";

const PWA_SHORTCUT_SCREENS = new Set<Screen>([
  "home",
  "learn",
  "records",
  "manage",
  "more",
  "backupCenter",
]);

const readInitialScreen = (): Screen => {
  if (typeof window === "undefined") return "home";
  const requested = new URLSearchParams(window.location.search).get("screen");
  return requested && PWA_SHORTCUT_SCREENS.has(requested as Screen)
    ? (requested as Screen)
    : "home";
};

const calculateInstantScore = (
  responseTimeSeconds: number,
  thresholdSeconds: number,
): number =>
  thresholdSeconds <= 0
    ? 0
    : Math.max(0, 1 - responseTimeSeconds / thresholdSeconds);

const sectionForScreen = (screen: Screen): NavigationSection => {
  if (screen === "learn" || screen === "session" || screen === "result")
    return "learn";
  if (
    [
      "records",
      "statistics",
      "history",
      "speedAnalysis",
      "mistakeNotes",
    ].includes(screen)
  )
    return "records";
  if (
    [
      "manage",
      "questions",
      "csvImport",
      "annotations",
      "corrections",
      "factCheck",
      "similarQuestion",
    ].includes(screen)
  )
    return "manage";
  if (["more", "setup", "backupCenter", "aiTemplates"].includes(screen))
    return "more";
  return "home";
};

const forecastLabel = (status: string) => {
  if (status === "AHEAD") return "計画より先行";
  if (status === "BEHIND") return "要ペース調整";
  return "計画どおり";
};

export default function App() {
  const [pendingHistory, setPendingHistory] = useState<StudyHistory | null>(
    null,
  );
  const [dailyTimeLimit, setDailyTimeLimit] = useState(0);
  const [timeBudgetMessage, setTimeBudgetMessage] = useState("");
  const [mistakeNotes, setMistakeNotes] = useState<MistakeNote[]>([]);
  const [annotations, setAnnotations] = useState<QuestionAnnotation[]>([]);
  const [correctionSuggestions, setCorrectionSuggestions] = useState<
    CorrectionSuggestion[]
  >([]);
  const [aiPromptTemplates, setAiPromptTemplates] = useState<
    AiPromptTemplate[]
  >([]);
  const [correctionQuestionId, setCorrectionQuestionId] = useState("");
  const [requiresInitialSetup, setRequiresInitialSetup] = useState(false);
  const [screen, setScreen] = useState<Screen>(readInitialScreen);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [questionStates, setQuestionStates] = useState<QuestionState[]>([]);
  const [generatedSession, setGeneratedSession] =
    useState<GeneratedStudySession | null>(null);
  const [storedQuestions, setStoredQuestions] = useState<Question[]>(questions);
  const [setup, setSetup] = useState<Setup>(createDefaultSetup());
  const [history, setHistory] = useState<StudyHistory[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [examScopes, setExamScopes] = useState<ExamScope[]>(defaultExamScopes);
  const [studySelection, setStudySelection] = useState<StudySelection>(() =>
    selectionFromSetup(createDefaultSetup()),
  );
  const [activeQuestions, setActiveQuestions] = useState<Question[]>(questions);
  const [weakMessage, setWeakMessage] = useState("");
  const [questionShownAt, setQuestionShownAt] = useState<number | null>(null);
  const [currentResponseTime, setCurrentResponseTime] = useState(0);
  const [currentInstantScore, setCurrentInstantScore] = useState(0);
  const [resumableSession, setResumableSession] =
    useState<ActiveSessionSnapshot | null>(null);
  const [sessionCorrectCount, setSessionCorrectCount] = useState(0);
  const [sessionResult, setSessionResult] = useState({
    correctCount: 0,
    totalCount: 0,
  });
  const [editQuestionId, setEditQuestionId] = useState("");
  const [storageError, setStorageError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const initialize = async () => {
      try {
        recoverStorageTransaction();
        migrateLegacyStorage();
      } catch (error) {
        setStorageError(
          error instanceof Error
            ? error.message
            : "前回の保存状態を確認できませんでした。",
        );
      }
      const safeLoad = <T,>(load: () => T, fallback: T): T => {
        try {
          return load();
        } catch (error) {
          setStorageError(
            error instanceof Error
              ? error.message
              : "端末内データの読込みに失敗しました。",
          );
          return fallback;
        }
      };
      const localSetup = safeLoad(loadSetup, null);
      let saved = localSetup;
      try {
        const indexedSetup = await findSetup();
        if (indexedSetup) saved = indexedSetup;
        else if (localSetup) await persistSetup(localSetup);
      } catch {
        // IndexedDBを利用できない環境では既存の端末内データで継続する。
      }
      if (cancelled) return;
      if (saved) {
        setSetup(saved);
        setStudySelection(selectionFromSetup(saved));
        try {
          saveSetup(saved);
        } catch (error) {
          setStorageError(
            error instanceof Error
              ? error.message
              : "設定の互換保存に失敗しました。",
          );
        }
        setRequiresInitialSetup(saved.setupCompleted !== true);
      } else {
        setRequiresInitialSetup(true);
      }
      const loadedHistory = safeLoad(loadHistory, []);
      setHistory(loadedHistory);
      setMistakeNotes(safeLoad(loadMistakeNotes, []));
      setAnnotations(safeLoad(loadQuestionAnnotations, []));
      setCorrectionSuggestions(safeLoad(loadCorrectionSuggestions, []));
      setAiPromptTemplates(safeLoad(loadAiPromptTemplates, []));
      setDailyTimeLimit(safeLoad(loadDailyTimeLimit, 0));
      setQuestionStates(safeLoad(() => loadQuestionStates(loadedHistory), []));
      setStoredQuestions(safeLoad(loadQuestions, questions));
      try {
        setExamScopes(await readExamScopes());
      } catch {
        setExamScopes(defaultExamScopes);
      }
      setResumableSession(safeLoad(loadActiveSession, null));
      setLoaded(true);
    };
    void initialize();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    applyTheme(setup.theme, setup.visualTheme);
    if (setup.theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => applyTheme("system", setup.visualTheme);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [setup.theme, setup.visualTheme]);

  useEffect(() => {
    const section = sectionForScreen(screen);
    const labels: Record<NavigationSection, string> = {
      home: setup.name || "Study Quiz",
      learn: "学習",
      records: "記録・分析",
      manage: "問題・教材管理",
      more: "その他",
    };
    document.title = `${labels[section]} - Study Quiz`;
  }, [screen, setup.name]);

  useEffect(() => {
    if (!loaded || requiresInitialSetup) return;
    const frame = window.requestAnimationFrame(() => {
      const heading = document.querySelector<HTMLElement>("main h1");
      if (!heading) return;
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loaded, requiresInitialSetup, screen]);

  const availableQuestions = useMemo(
    () => storedQuestions.filter((question) => !question.archivedAt),
    [storedQuestions],
  );
  const availableQuestionIds = useMemo(
    () => new Set(availableQuestions.map((question) => question.id)),
    [availableQuestions],
  );

  const filteredQuestions = useMemo(() => {
    const selectedCategories = new Set(normalizeStudyCategories(studySelection.categories));
    const selectedMastery = new Set(
      normalizeMasteryFilters(studySelection.masteryFilters),
    );
    return availableQuestions.filter((question) => {
        if (question.examScopeId !== studySelection.examScopeId) return false;
        if (!selectedCategories.has("ALL") && !selectedCategories.has(question.category)) return false;
        const mastery = questionStates.find((state) => state.questionId === question.id)?.masteryLevel ?? "UNLEARNED";
        if (!selectedMastery.has("ALL") && !selectedMastery.has(mastery)) return false;
        return studySelection.questionIds.length === 0 || studySelection.questionIds.includes(question.id);
      });
  }, [availableQuestions, questionStates, studySelection]);
  const sessionPreview = useMemo(
    () =>
      generateSelectedStudySession(
        availableQuestions,
        history,
        setup,
        questionStates,
        studySelection,
      ),
    [availableQuestions, history, setup, questionStates, studySelection],
  );
  const remainingDays = useMemo(() => {
    return getRemainingDays(setup.examDate);
  }, [setup.examDate]);
  const progressForecast = useMemo(
    () =>
      calculateProgressForecast(
        filteredQuestions,
        history,
        questionStates,
        sessionPreview.remainingNewQuestions,
        sessionPreview.effectiveDays,
        setup.bufferRate,
      ),
    [
      filteredQuestions,
      history,
      questionStates,
      sessionPreview.remainingNewQuestions,
      sessionPreview.effectiveDays,
      setup.bufferRate,
    ],
  );
  const dailyMinimumProgress = useMemo(
    () => calculateDailyMinimumProgress(history, setup.dailyMinimumQuestions),
    [history, setup.dailyMinimumQuestions],
  );
  const forgettingCandidates = useMemo(
    () => detectForgettingCandidates(filteredQuestions, history),
    [filteredQuestions, history],
  );
  const studyStreak = useMemo(
    () => calculateStudyStreak(history, getEffectiveReservedDates(setup)),
    [history, setup],
  );
  const finalReviewPlan = useMemo(
    () =>
      createFinalReviewPlan(
        filteredQuestions,
        history,
        questionStates,
        remainingDays,
        Math.min(20, setup.dailyQuestionLimit),
      ),
    [
      filteredQuestions,
      history,
      questionStates,
      remainingDays,
      setup.dailyQuestionLimit,
    ],
  );
  const dailyTimeBudget = useMemo(
    () => calculateDailyTimeBudget(history, dailyTimeLimit),
    [history, dailyTimeLimit],
  );

  const masteredCount = questionStates.filter(
    (state) =>
      availableQuestionIds.has(state.questionId) &&
      state.masteryLevel === "MASTERED",
  ).length;
  const learningCount = questionStates.filter(
    (state) =>
      availableQuestionIds.has(state.questionId) &&
      state.masteryLevel === "LEARNING",
  ).length;
  const unlearnedCount = Math.max(
    0,
    availableQuestions.length - masteredCount - learningCount,
  );
  const correctCount = history.filter((item) => item.correct).length;
  const accuracy = history.length
    ? Math.round((correctCount / history.length) * 100)
    : 0;

  const commitQuestions = (items: Question[]): boolean => {
    try {
      saveQuestions(items);
      setStoredQuestions(items);
      setStudySelection((current) => {
        const validIds = new Set(items.filter((question) => !question.archivedAt).map((question) => question.id));
        const availableCategories = new Set(items.filter((question) => !question.archivedAt && question.examScopeId === current.examScopeId).map((question) => question.category));
        const normalizedCategories = normalizeStudyCategories(current.categories);
        const validCategories = normalizedCategories.includes("ALL")
          ? ["ALL"]
          : normalizedCategories.filter((category) => availableCategories.has(category));
        return {
          ...current,
          categories: validCategories.length > 0 ? validCategories : ["ALL"],
          questionIds: current.questionIds.filter((id) => validIds.has(id)),
        };
      });
      setStorageError("");
      return true;
    } catch (error) {
      setStorageError(
        error instanceof Error
          ? error.message
          : "問題データを保存できませんでした。",
      );
      return false;
    }
  };

  const commitLocalData = <T,>(
    items: T[],
    save: (value: T[]) => void,
    apply: (value: T[]) => void,
    label: string,
  ): boolean => {
    try {
      save(items);
      apply(items);
      setStorageError("");
      return true;
    } catch (error) {
      const reason =
        error instanceof Error
          ? error.message
          : "端末内ストレージへ保存できませんでした。";
      setStorageError(`${label}を保存できませんでした。${reason}`);
      return false;
    }
  };

  const startQuestionTimer = () => setQuestionShownAt(performance.now());
  const resetQuestionState = () => {
    setSelectedAnswer(null);
    setShowAnswer(false);
    setCurrentResponseTime(0);
    setCurrentInstantScore(0);
    setTimeout(startQuestionTimer, 0);
  };
  const discardActiveSession = (): boolean => {
    try {
      clearActiveSession();
      setResumableSession(null);
      return true;
    } catch (error) {
      setStorageError(
        error instanceof Error
          ? error.message
          : "中断セッションを削除できませんでした。",
      );
      return false;
    }
  };
  const beginQuiz = (targets: Question[]) => {
    if (targets.length === 0) return;
    const fitted = fitQuestionsToTimeBudget(targets, dailyTimeBudget);
    if (fitted.length === 0) {
      setTimeBudgetMessage(
        "本日の学習時間上限に到達しています。上限を変更するか、翌日に再開してください。",
      );
      return;
    }
    setTimeBudgetMessage(
      fitted.length < targets.length
        ? `残り時間に合わせて ${fitted.length}問へ調整しました。`
        : "",
    );
    let snapshot: ActiveSessionSnapshot;
    try {
      snapshot = saveActiveSession({
        questionIds: fitted.map((question) => question.id),
        currentIndex: 0,
        correctCount: 0,
        startedAt: new Date().toISOString(),
      });
    } catch (error) {
      setStorageError(
        error instanceof Error
          ? error.message
          : "学習セッションを保存できませんでした。",
      );
      return;
    }
    setStorageError("");
    setActiveQuestions(fitted);
    setQuestionIndex(0);
    setSessionCorrectCount(0);
    setWeakMessage("");
    setResumableSession(snapshot);
    setScreen("quiz");
    resetQuestionState();
  };
  const resumeQuiz = () => {
    if (!resumableSession) return;
    const reconciled = reconcileActiveSessionSnapshot(
      resumableSession,
      availableQuestions,
    );
    if (!reconciled) {
      discardActiveSession();
      return;
    }
    if (reconciled.changed) {
      try {
        saveActiveSession(reconciled.snapshot);
      } catch (error) {
        setStorageError(
          error instanceof Error
            ? error.message
            : "中断セッションの補正結果を保存できませんでした。",
        );
      }
    }
    setActiveQuestions(reconciled.questions);
    setQuestionIndex(reconciled.snapshot.currentIndex);
    setSessionCorrectCount(reconciled.snapshot.correctCount);
    setResumableSession(reconciled.snapshot);
    setScreen("quiz");
    resetQuestionState();
  };
  const abandonSession = () => {
    if (!discardActiveSession()) return;
    setPendingHistory(null);
    setSelectedAnswer(null);
    setShowAnswer(false);
  };
  const beginWeakQuiz = () => {
    const targets = selectWeakQuestions(
      filteredQuestions,
      history,
      setup.dailyQuestionLimit,
    );
    if (targets.length === 0) {
      setWeakMessage(
        "苦手問題の判定対象がありません。問題へ回答するか、現在の履歴では弱点基準に該当していません。",
      );
      return;
    }
    beginQuiz(targets);
  };
  const beginForgettingQuiz = () => {
    const targets = selectForgettingQuestions(
      availableQuestions,
      history,
      setup.dailyQuestionLimit,
    );
    if (targets.length > 0) beginQuiz(targets);
  };
  const beginFinalReview = () => {
    if (finalReviewPlan.questions.length > 0)
      beginQuiz(finalReviewPlan.questions);
  };
  const answerQuestion = () => {
    if (selectedAnswer === null || showAnswer) return;
    const question = activeQuestions[questionIndex];
    const elapsed = Math.max(
      0,
      (performance.now() - (questionShownAt ?? performance.now())) / 1000,
    );
    const responseTimeSeconds = Math.round(elapsed * 10) / 10;
    const instantScore =
      Math.round(
        calculateInstantScore(
          responseTimeSeconds,
          setup.instantThresholdSeconds,
        ) * 1000,
      ) / 1000;
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
    setStorageError("");
    setCurrentResponseTime(responseTimeSeconds);
    setCurrentInstantScore(instantScore);
    setShowAnswer(true);
  };
  const applyFsrsRating = (rating: FsrsRating) => {
    if (!pendingHistory) return;
    const previous = questionStates.find(
      (state) => state.questionId === pendingHistory.questionId,
    );
    const fsrsCard = scheduleFsrs(
      previous?.fsrsCard ?? null,
      rating,
      new Date(pendingHistory.answeredAt),
    );
    const item: StudyHistory = { ...pendingHistory, fsrsRating: rating };
    const updated = [item, ...history];
    let updatedStates = updateQuestionStates(questionStates, item);
    updatedStates = updatedStates.map((state) =>
      state.questionId === item.questionId
        ? {
            ...state,
            fsrsCard,
            nextReviewAt: fsrsCard.due,
            fsrsStability: fsrsCard.stability,
            fsrsDifficulty: fsrsCard.difficulty,
          }
        : state,
    );
    const correctCountForSession = sessionCorrectCount + (item.correct ? 1 : 0);
    const hasNextQuestion = questionIndex + 1 < activeQuestions.length;
    const nextIndex = questionIndex + 1;
    const nextSnapshot: ActiveSessionSnapshot | null = hasNextQuestion
      ? {
          questionIds: activeQuestions.map((question) => question.id),
          currentIndex: nextIndex,
          correctCount: correctCountForSession,
          startedAt: resumableSession?.startedAt ?? new Date().toISOString(),
        }
      : null;

    try {
      saveLearningProgress({
        history: updated,
        questionStates: updatedStates,
        activeSession: nextSnapshot,
      });
    } catch (error) {
      setStorageError(
        error instanceof Error
          ? error.message
          : "回答結果を保存できませんでした。もう一度お試しください。",
      );
      return;
    }

    setStorageError("");
    setHistory(updated);
    setQuestionStates(updatedStates);
    setPendingHistory(null);
    setSessionCorrectCount(correctCountForSession);
    if (hasNextQuestion && nextSnapshot) {
      setQuestionIndex(nextIndex);
      setResumableSession(nextSnapshot);
      resetQuestionState();
    } else {
      setResumableSession(null);
      setSessionResult({
        correctCount: correctCountForSession,
        totalCount: activeQuestions.length,
      });
      setQuestionIndex(0);
      setScreen("result");
      setSelectedAnswer(null);
      setShowAnswer(false);
    }
  };

  const navigate = (section: NavigationSection) => {
    setCorrectionQuestionId("");
    setScreen(section);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const withChrome = (content: ReactNode) => (
    <AppChrome
      active={sectionForScreen(screen)}
      onNavigate={navigate}
      remainingDays={remainingDays}
      completedToday={dailyMinimumProgress.completed}
      dailyMinimum={dailyMinimumProgress.minimum}
      streakDays={studyStreak.currentDays}
      showContextHelp={screen !== "setup" && screen !== "statistics"}
    >
      {storageError && (
        <aside className="storage-error-banner" role="alert">
          <span>{storageError}</span>
          <button type="button" onClick={() => setStorageError("")}>
            閉じる
          </button>
        </aside>
      )}
      {content}
    </AppChrome>
  );

  if (!loaded) {
    return (
      <main className="app-shell">
        <section className="home-card">
          <h1>Loading...</h1>
        </section>
      </main>
    );
  }
  if (requiresInitialSetup) {
    return (
      <InitialSetupPage
        setup={setup}
        examScopes={examScopes}
        questions={availableQuestions}
        onSave={async (next) => {
          const completed = await new SaveInitialSetupUseCase().execute(next);
          saveSetup(completed);
          setSetup(completed);
          setStudySelection(selectionFromSetup(completed));
          setRequiresInitialSetup(false);
          setScreen("home");
        }}
      />
    );
  }

  if (screen === "csvImport") {
    return withChrome(
      <CsvImportPage
        existingQuestions={storedQuestions}
        onImport={(items) => {
          const updated = [...storedQuestions, ...items];
          return commitQuestions(updated);
        }}
        onBack={() => setScreen("questions")}
      />,
    );
  }
  if (screen === "questions") {
    return withChrome(
      <QuestionManagementPage
        questions={storedQuestions}
        questionStates={questionStates}
        examScopes={examScopes}
        initialQuestionId={editQuestionId}
        onInitialEditHandled={() => setEditQuestionId("")}
        onChange={commitQuestions}
        onImport={() => setScreen("csvImport")}
        onBack={() => setScreen("manage")}
      />,
    );
  }
  if (screen === "similarQuestion") {
    return withChrome(
      <SimilarQuestionGeneratorPage
        questions={availableQuestions}
        onRegister={(question) =>
          commitQuestions([...storedQuestions, question])
        }
        onBack={() => setScreen("manage")}
      />,
    );
  }
  if (screen === "factCheck") {
    return withChrome(
      <BatchFactCheckPage
        questions={availableQuestions}
        suggestions={correctionSuggestions}
        onSuggestionsChange={(items) =>
          commitLocalData(
            items,
            saveCorrectionSuggestions,
            setCorrectionSuggestions,
            "修正提案",
          )
        }
        onBack={() => setScreen("manage")}
      />,
    );
  }
  if (screen === "speedAnalysis") {
    return withChrome(
      <ResponseSpeedAnalysisPage
        questions={availableQuestions}
        history={history}
        limit={setup.dailyQuestionLimit}
        onStart={beginQuiz}
        onBack={() => setScreen("records")}
      />,
    );
  }
  if (screen === "aiTemplates") {
    return withChrome(
      <AiPromptTemplatesPage
        questions={availableQuestions}
        items={aiPromptTemplates}
        onChange={(items) =>
          commitLocalData(
            items,
            saveAiPromptTemplates,
            setAiPromptTemplates,
            "AI質問テンプレート",
          )
        }
        onBack={() => setScreen("more")}
      />,
    );
  }
  if (screen === "backupCenter") {
    return withChrome(<BackupCenterPage onBack={() => setScreen("more")} />);
  }
  if (screen === "history") {
    return withChrome(
      <LearningHistoryPage
        history={history}
        questions={storedQuestions}
        onBack={() => setScreen("records")}
      />,
    );
  }
  if (screen === "corrections") {
    return withChrome(
      <CorrectionSuggestionsPage
        questions={storedQuestions}
        items={correctionSuggestions}
        initialQuestionId={correctionQuestionId}
        onChange={(items) =>
          commitLocalData(
            items,
            saveCorrectionSuggestions,
            setCorrectionSuggestions,
            "修正提案",
          )
        }
        onEditQuestion={(questionId) => {
          setEditQuestionId(questionId);
          setCorrectionQuestionId("");
          setScreen("questions");
        }}
        onBack={() => {
          setCorrectionQuestionId("");
          setScreen("manage");
        }}
      />,
    );
  }
  if (screen === "annotations") {
    return withChrome(
      <FavoritesMemoPage
        questions={availableQuestions}
        annotations={annotations}
        onChange={(items) =>
          commitLocalData(
            items,
            saveQuestionAnnotations,
            setAnnotations,
            "お気に入り・メモ",
          )
        }
        onStart={beginQuiz}
        onBack={() => setScreen("manage")}
      />,
    );
  }
  if (screen === "mistakeNotes") {
    return withChrome(
      <MistakeNotesPage
        questions={storedQuestions}
        history={history}
        notes={mistakeNotes}
        onChange={(items) =>
          commitLocalData(
            items,
            saveMistakeNotes,
            setMistakeNotes,
            "間違いノート",
          )
        }
        onStart={beginQuiz}
        onBack={() => setScreen("records")}
      />,
    );
  }
  if (screen === "statistics") {
    return withChrome(
      <StatisticsPage
        history={history}
        questionStates={questionStates}
        questions={storedQuestions}
        instantThresholdSeconds={setup.instantThresholdSeconds}
        onBack={() => setScreen("records")}
      />,
    );
  }
  if (screen === "setup") {
    return withChrome(
      <SettingsPage
        setup={setup}
        examScopes={examScopes}
        questions={availableQuestions}
        questionStates={questionStates}
        onSave={async (next) => {
          const completed = { ...next, setupCompleted: true };
          await persistSetup(completed);
          saveSetup(completed);
          setSetup(completed);
          setStudySelection(selectionFromSetup(completed));
          setRequiresInitialSetup(false);
          setScreen("more");
        }}
        onCancel={() => setScreen("more")}
      />,
    );
  }
  if (screen === "session") {
    const session = generatedSession ?? sessionPreview;
    return withChrome(
      <main className="app-shell">
        <section className="home-card">
          <h1>学習セッション</h1>
          <div className="exam-summary">
            <div className="summary-row">
              <span>出題範囲</span>
              <strong>{studyRangeLabel(studySelection.categories)}</strong>
            </div>
            <div className="summary-row">
              <span>理解度</span>
              <strong>{masteryFiltersLabel(studySelection.masteryFilters)}</strong>
            </div>
            <div className="summary-row">
              <span>出題方法</span>
              <strong>{questionModesLabel(studySelection.questionModes)}</strong>
            </div>
            <div className="summary-row">
              <span>対象問題数</span>
              <strong>{session.totalCount}</strong>
            </div>
            <div className="summary-row">
              <span>推定時間</span>
              <strong>{session.estimatedMinutes}分</strong>
            </div>
            <div className="summary-row">
              <span>新規 / 復習 / 弱点 / 指定</span>
              <strong>
                {session.newCount} / {session.reviewCount} / {session.weakCount} / {session.otherCount}問
              </strong>
            </div>
          </div>
          <SessionPlanDetails items={session.items} />
          <button
            className="primary-button"
            type="button"
            onClick={() =>
              beginQuiz(session.items.map((item) => item.question))
            }
            disabled={session.totalCount === 0}
          >
            学習開始
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => setScreen("learn")}
          >
            学習メニューへ戻る
          </button>
        </section>
      </main>,
    );
  }
  if (screen === "result") {
    return withChrome(
      <ResultPage
        correctCount={sessionResult.correctCount}
        totalCount={sessionResult.totalCount}
        onHome={() => setScreen("home")}
        onRetry={() => beginQuiz(activeQuestions)}
      />,
    );
  }
  if (screen === "quiz") {
    const question = activeQuestions[questionIndex];
    if (!question) return null;
    return (
      <main className="app-shell quiz-shell">
        <section className="home-card quiz-card">
          <div className="quiz-toolbar">
            <button
              type="button"
              onClick={() => {
                setResumableSession(loadActiveSession());
                setScreen("learn");
              }}
            >
              中断
            </button>
            <div
              className="quiz-progress"
              aria-label={`${activeQuestions.length}問中${questionIndex + 1}問目`}
            >
              {questionIndex + 1} / {activeQuestions.length}
            </div>
          </div>
          <div className="quiz-progress-track" aria-hidden="true">
            <span
              style={{
                width: `${((questionIndex + 1) / activeQuestions.length) * 100}%`,
              }}
            />
          </div>
          <p className="question-meta">
            {question.category}
            {question.subcategory ? ` / ${question.subcategory}` : ""}
          </p>
          <h1 className="question-title">{question.text}</h1>
          <div className="form-grid">
            {question.choices.map((choice, index) => {
              const selected = selectedAnswer === index;
              let className = "secondary-button choice-button";
              if (!showAnswer && selected) className += " choice-selected";
              if (showAnswer && index === question.answerIndex)
                className += " choice-correct";
              if (showAnswer && selected && index !== question.answerIndex)
                className += " choice-wrong";
              return (
                <button
                  key={`${question.id}-${index}`}
                  className={className}
                  type="button"
                  aria-pressed={selected}
                  disabled={showAnswer}
                  onClick={() => setSelectedAnswer(index)}
                >
                  <span className="choice-index" aria-hidden="true">
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span>{choice}</span>
                </button>
              );
            })}
          </div>
          {selectedAnswer !== null && !showAnswer && (
            <button
              className="primary-button"
              type="button"
              onClick={answerQuestion}
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
                  <span>回答時間</span>
                  <strong>{currentResponseTime.toFixed(1)}秒</strong>
                </div>
                <div className="summary-row">
                  <span>即答スコア</span>
                  <strong>{Math.round(currentInstantScore * 100)}%</strong>
                </div>
                <div className="explanation-row">
                  <span>解説</span>
                  <p>{question.explanation}</p>
                </div>
              </div>
              <AiQuestionPanel
                question={question}
                selectedIndex={selectedAnswer}
              />
              <button
                className="correction-open-button"
                type="button"
                onClick={() => {
                  setCorrectionQuestionId(question.id);
                  setScreen("corrections");
                }}
              >
                問題の修正を提案
              </button>
              {storageError && (
                <div className="error-box" role="alert">
                  {storageError}
                </div>
              )}
              <div className="fsrs-rating">
                <p>記憶の状態を選択してください</p>
                <div className="fsrs-rating-grid">
                  <button
                    className="rating-again"
                    type="button"
                    onClick={() => applyFsrsRating("AGAIN")}
                  >
                    忘れた<small>すぐ復習</small>
                  </button>
                  <button
                    className="rating-hard"
                    type="button"
                    onClick={() => applyFsrsRating("HARD")}
                  >
                    難しい<small>短めの間隔</small>
                  </button>
                  <button
                    className="rating-good"
                    type="button"
                    onClick={() => applyFsrsRating("GOOD")}
                  >
                    思い出せた<small>標準の間隔</small>
                  </button>
                  <button
                    className="rating-easy"
                    type="button"
                    onClick={() => applyFsrsRating("EASY")}
                  >
                    簡単<small>長めの間隔</small>
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </main>
    );
  }

  if (screen === "learn") {
    return withChrome(
      <main className="app-shell">
        <section className="home-card feature-hub-card">
          <div className="hub-heading">
            <p className="eyebrow">STUDY</p>
            <h1>学習</h1>
            <p>今日の計画、学習種別、使える時間から開始方法を選べます。</p>
          </div>
          {resumableSession && (
            <section className="resume-session-card" aria-label="中断した学習">
              <div>
                <span>中断した学習</span>
                <strong>
                  {resumableSession.currentIndex + 1}問目から再開できます
                </strong>
              </div>
              <div className="resume-session-actions">
                <button type="button" onClick={resumeQuiz}>
                  再開
                </button>
                <button type="button" onClick={abandonSession}>
                  破棄
                </button>
              </div>
            </section>
          )}
          <section className="hub-section">
            <h2>今日の学習計画</h2>
            <div className="compact-plan-grid">
              <article>
                <span>新規</span>
                <strong>{sessionPreview.newCount}</strong>
                <small>問</small>
              </article>
              <article>
                <span>復習</span>
                <strong>{sessionPreview.reviewCount}</strong>
                <small>問</small>
              </article>
              <article>
                <span>{sessionPreview.otherCount > 0 ? "指定" : "弱点"}</span>
                <strong>{sessionPreview.otherCount > 0 ? sessionPreview.otherCount : sessionPreview.weakCount}</strong>
                <small>問</small>
              </article>
              <article className="is-total">
                <span>合計</span>
                <strong>{sessionPreview.totalCount}</strong>
                <small>問</small>
              </article>
            </div>
            <StudyFilterPanel
              value={studySelection}
              examScopes={examScopes}
              questions={availableQuestions}
              questionStates={questionStates}
              onChange={setStudySelection}
            />
            <button
              className="primary-button"
              type="button"
              onClick={() => {
                setGeneratedSession(sessionPreview);
                setScreen("session");
              }}
            >
              学習計画を確認して開始
            </button>
            <StudySourceLauncher
              items={sessionPreview.items}
              onStart={beginQuiz}
            />
          </section>
          <section className="hub-section">
            <h2>ペースと学習モード</h2>
            <DailyMinimumCard progress={dailyMinimumProgress} />
            <DailyTimeBudgetCard
              budget={dailyTimeBudget}
              onSave={(minutes) => {
                try {
                  setDailyTimeLimit(saveDailyTimeLimit(minutes));
                  setStorageError("");
                } catch (error) {
                  setStorageError(
                    error instanceof Error
                      ? error.message
                      : "学習時間上限を保存できませんでした。",
                  );
                }
              }}
            />
            {timeBudgetMessage && (
              <div className="time-budget-message">{timeBudgetMessage}</div>
            )}
            <TimeBasedSessionCard
              items={sessionPreview.items}
              onStart={beginQuiz}
            />
            <ForgettingAlertCard
              candidates={forgettingCandidates}
              onStart={beginForgettingQuiz}
            />
            <FinalReviewCard
              plan={finalReviewPlan}
              remainingDays={remainingDays}
              onStart={beginFinalReview}
            />
            <button
              className="weak-button"
              type="button"
              onClick={beginWeakQuiz}
            >
              苦手問題だけ学習
            </button>
            {weakMessage && <div className="weak-message">{weakMessage}</div>}
          </section>
        </section>
      </main>,
    );
  }

  if (screen === "records") {
    return withChrome(
      <main className="app-shell">
        <section className="home-card feature-hub-card">
          <div className="hub-heading">
            <p className="eyebrow">RECORDS</p>
            <h1>記録・分析</h1>
            <p>学習結果と弱点を確認し、次に取り組む内容を判断します。</p>
          </div>
          <div className="stats-grid records-summary">
            <article>
              <span>回答数</span>
              <strong>{history.length}</strong>
              <small>問</small>
            </article>
            <article>
              <span>正答率</span>
              <strong>{accuracy}</strong>
              <small>%</small>
            </article>
            <article>
              <span>習得済み</span>
              <strong>{masteredCount}</strong>
              <small>問</small>
            </article>
          </div>
          <div className="feature-link-list">
            <FeatureLink
              icon="statistics"
              title="統計"
              description="期間・分野別の成績と定着度"
              badge={`${accuracy}%`}
              onClick={() => setScreen("statistics")}
            />
            <FeatureLink
              icon="history"
              title="学習履歴"
              description="回答結果、時間、FSRS評価を確認"
              badge={`${history.length}件`}
              tone="green"
              onClick={() => setScreen("history")}
            />
            <FeatureLink
              icon="timer"
              title="回答速度分析"
              description="速度悪化と即答スコアを分析"
              tone="amber"
              onClick={() => setScreen("speedAnalysis")}
            />
            <FeatureLink
              icon="alert"
              title="間違いノート"
              description="誤答原因と正しい知識を整理"
              badge={`${mistakeNotes.length}件`}
              tone="violet"
              onClick={() => setScreen("mistakeNotes")}
            />
          </div>
          <ProgressForecastCard forecast={progressForecast} />
          <StreakCard streak={studyStreak} />
        </section>
      </main>,
    );
  }

  if (screen === "manage") {
    const favoriteCount = annotations.filter((item) => item.favorite).length;
    const pendingCorrections = correctionSuggestions.filter(
      (item) => item.status === "pending",
    ).length;
    return withChrome(
      <main className="app-shell">
        <section className="home-card feature-hub-card">
          <div className="hub-heading">
            <p className="eyebrow">MANAGE</p>
            <h1>問題・教材管理</h1>
            <p>問題データ、メモ、品質確認をこの画面にまとめました。</p>
          </div>
          <div className="feature-link-list">
            <FeatureLink
              icon="questions"
              title="問題管理"
              description="検索、登録、編集、アーカイブ、CSV取込"
              badge={`${availableQuestions.length}問`}
              onClick={() => setScreen("questions")}
            />
            <FeatureLink
              icon="sparkles"
              title="類似問題生成"
              description="AI案をコピー方式で作成し、確認後に登録"
              tone="green"
              onClick={() => setScreen("similarQuestion")}
            />
            <FeatureLink
              icon="star"
              title="お気に入り・メモ"
              description="重要な問題と個人メモを管理"
              badge={`${favoriteCount}件`}
              tone="amber"
              onClick={() => setScreen("annotations")}
            />
            <FeatureLink
              icon="edit"
              title="問題修正提案"
              description="問題を直接変更せず修正案を管理"
              badge={
                pendingCorrections > 0
                  ? `未確認 ${pendingCorrections}`
                  : undefined
              }
              tone="violet"
              onClick={() => {
                setCorrectionQuestionId("");
                setScreen("corrections");
              }}
            />
            <FeatureLink
              icon="shield-check"
              title="一括ファクトチェック"
              description="複数問題の確認結果を取り込む"
              tone="green"
              onClick={() => setScreen("factCheck")}
            />
          </div>
          <section className="hub-footnote-card" aria-label="教材カバレッジ">
            <strong>LPIC-1 101 教材カバレッジ</strong>
            <span>{examScopes.filter((item) => item.active).length}試験枠・{new Set(availableQuestions.map((item) => item.category)).size}トピック・{availableQuestions.length}問</span>
            <small>既定問題はLPIC-1 Exam 101のみです。不要な問題は削除せずアーカイブし、履歴との整合性を保ちます。</small>
          </section>
        </section>
      </main>,
    );
  }

  if (screen === "more") {
    return withChrome(
      <main className="app-shell">
        <section className="home-card feature-hub-card">
          <div className="hub-heading">
            <p className="eyebrow">MORE</p>
            <h1>その他</h1>
            <p>アプリ設定、データ保全、補助ツールを管理します。</p>
          </div>
          <div className="feature-link-list">
            <FeatureLink
              icon="settings"
              title="設定"
              description="試験日、非学習日、Gemini API、判定条件"
              tone="slate"
              onClick={() => setScreen("setup")}
            />
            <FeatureLink
              icon="backup"
              title="完全バックアップ"
              description="全データの出力と復元"
              tone="green"
              onClick={() => setScreen("backupCenter")}
            />
            <FeatureLink
              icon="ai"
              title="AI質問テンプレート"
              description="問題コンテキスト付きプロンプトを管理"
              tone="violet"
              onClick={() => setScreen("aiTemplates")}
            />
          </div>
          <section className="hub-footnote-card" aria-label="現在の表示と初期値">
            <strong>現在の表示・出題初期値</strong>
            <span>配色: {visualThemeLabel(setup.visualTheme)} ・ 明るさ: {colorModeLabel(setup.theme)}</span>
            <small>試験枠・学習範囲・理解度・出題方法は「設定」で変更できます。各画面の「？」から操作説明を確認できます。</small>
          </section>
          <section className="app-info-panel" aria-label="アプリ情報">
            <div>
              <span>保存先</span>
              <strong>この端末内</strong>
            </div>
            <div>
              <span>利用形態</span>
              <strong>PWA・オフライン対応</strong>
            </div>
            <p>
              通常の学習データは端末内に保存します。Geminiを設定した場合だけ、利用者が送信操作を行った質問内容をGemini APIへ送ります。APIキーはバックアップへ含めません。
            </p>
          </section>
        </section>
      </main>,
    );
  }

  return withChrome(
    <main className="app-shell dashboard-shell">
      <section className="home-card dashboard-card">
        <div className="dashboard-heading">
          <div className="brand-mark compact-brand" aria-hidden="true"><AppIcon name="logo" /></div>
          <div>
            <p className="eyebrow">TODAY</p>
            <h1>{setup.name}</h1>
            <p>
              {setup.examDate} ・{" "}
              {remainingDays > 0
                ? `あと${remainingDays}日`
                : remainingDays === 0
                  ? "試験当日"
                  : "試験日経過"}
            </p>
          </div>
        </div>

        {resumableSession && (
          <section className="resume-session-card" aria-label="中断した学習">
            <div>
              <span>続きから</span>
              <strong>
                {resumableSession.currentIndex + 1} /{" "}
                {resumableSession.questionIds.length}問
              </strong>
            </div>
            <div className="resume-session-actions">
              <button type="button" onClick={resumeQuiz}>
                学習を再開
              </button>
              <button type="button" onClick={abandonSession}>
                破棄
              </button>
            </div>
          </section>
        )}

        <section className="today-action-card">
          <div className="today-action-heading">
            <div>
              <span>今日の学習</span>
              <strong>{sessionPreview.totalCount}問</strong>
            </div>
            <b>{sessionPreview.estimatedMinutes}分目安</b>
          </div>
          <div className="today-counts" aria-label="今日の出題内訳">
            <span>
              新規 <strong>{sessionPreview.newCount}</strong>
            </span>
            <span>
              復習 <strong>{sessionPreview.reviewCount}</strong>
            </span>
            <span>
              {sessionPreview.otherCount > 0 ? "指定" : "弱点"}{" "}
              <strong>{sessionPreview.otherCount > 0 ? sessionPreview.otherCount : sessionPreview.weakCount}</strong>
            </span>
          </div>
          <button
            className="primary-button large-button"
            type="button"
            onClick={() => {
              setGeneratedSession(sessionPreview);
              setScreen("session");
            }}
          >
            今日の学習を開始
          </button>
          <button
            className="inline-link-button"
            type="button"
            onClick={() => setScreen("learn")}
          >
            学習メニューと別モードを見る
          </button>
        </section>

        <section className="home-overview" aria-label="本日の状況">
          <article className={dailyMinimumProgress.achieved ? "is-good" : ""}>
            <span>最低ライン</span>
            <strong>
              {dailyMinimumProgress.completed}/{dailyMinimumProgress.minimum}問
            </strong>
            <small>
              {dailyMinimumProgress.achieved
                ? "達成済み"
                : `あと${dailyMinimumProgress.remaining}問`}
            </small>
          </article>
          <article>
            <span>連続学習</span>
            <strong>{studyStreak.currentDays}日</strong>
            <small>
              {studyStreak.studiedToday ? "本日学習済み" : "本日未学習"}
            </small>
          </article>
          <article
            className={
              progressForecast.status === "BEHIND" ? "is-warning" : "is-good"
            }
          >
            <span>進捗予測</span>
            <strong>{forecastLabel(progressForecast.status)}</strong>
            <small>直近7日から判定</small>
          </article>
          <article>
            <span>定着状況</span>
            <strong>{masteredCount}問</strong>
            <small>
              学習中 {learningCount}・未学習 {unlearnedCount}
            </small>
          </article>
        </section>

        <section className="home-scope-summary" aria-label="現在の出題設定">
          <div><span>試験枠</span><strong>{examScopes.find((item) => item.id === studySelection.examScopeId)?.name ?? studySelection.examScopeId}</strong></div>
          <div><span>範囲</span><strong>{studyRangeLabel(studySelection.categories)}</strong></div>
          <div><span>理解度</span><strong>{masteryFiltersLabel(studySelection.masteryFilters)}</strong></div>
          <div><span>出題方法</span><strong>{questionModesLabel(studySelection.questionModes)}</strong></div>
          <div><span>対象</span><strong>{filteredQuestions.length}問</strong></div>
          <button type="button" onClick={() => setScreen("learn")}>出題条件を変更</button>
        </section>
        <nav className="home-quick-links" aria-label="クイックアクセス">
          <button type="button" onClick={() => setScreen("learn")}><AppIcon name="learn" /><span><strong>学習条件</strong><small>範囲・出題方法を変更</small></span></button>
          <button type="button" onClick={() => setScreen("records")}><AppIcon name="records" /><span><strong>記録を見る</strong><small>成績・弱点を確認</small></span></button>
          <button type="button" onClick={() => setScreen("setup")}><AppIcon name="palette" /><span><strong>表示を変更</strong><small>テーマ・明るさを選択</small></span></button>
        </nav>
        <LearningProgressCharts history={history} questions={filteredQuestions} days={7} compact />

        {forgettingCandidates.length > 0 && (
          <button
            className="home-alert"
            type="button"
            onClick={() => setScreen("learn")}
          >
            <span>忘れかけ候補が {forgettingCandidates.length}問あります</span>
            <strong>学習画面で確認 ›</strong>
          </button>
        )}
      </section>
    </main>,
  );
}

