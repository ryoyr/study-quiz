import type { StudyHistory } from "../types/StudyHistory";
import type { MasteryLevel, QuestionState } from "../types/QuestionState";
import { STORAGE_KEYS } from "./storageKeyRegistry.ts";

const KEY = STORAGE_KEYS.questionStates;
const mastery = (
  correct: number,
  total: number,
  instant: number,
): MasteryLevel => {
  if (total === 0) return "UNLEARNED";
  const accuracy = correct / total;
  return total >= 3 && accuracy >= 0.8 && instant >= 0.35
    ? "MASTERED"
    : "LEARNING";
};
export const createEmptyQuestionState = (
  questionId: string,
): QuestionState => ({
  questionId,
  correctCount: 0,
  incorrectCount: 0,
  totalCount: 0,
  averageResponseTimeSeconds: 0,
  recentResponseTimeSeconds: 0,
  averageInstantScore: 0,
  recentInstantScore: 0,
  recentIncorrect: false,
  lastAnsweredAt: null,
  masteryLevel: "UNLEARNED",
  fsrsCard: null,
  nextReviewAt: null,
  fsrsStability: 0,
  fsrsDifficulty: 0,
});
export const applyHistoryToState = (
  previous: QuestionState | undefined,
  item: StudyHistory,
): QuestionState => {
  const state = previous ?? createEmptyQuestionState(item.questionId);
  const total = state.totalCount + 1;
  const correct = state.correctCount + (item.correct ? 1 : 0);
  const incorrect = state.incorrectCount + (item.correct ? 0 : 1);
  const averageResponseTimeSeconds =
    state.averageResponseTimeSeconds +
    (item.responseTimeSeconds - state.averageResponseTimeSeconds) / total;
  const averageInstantScore =
    state.averageInstantScore +
    (item.instantScore - state.averageInstantScore) / total;
  return {
    questionId: item.questionId,
    correctCount: correct,
    incorrectCount: incorrect,
    totalCount: total,
    averageResponseTimeSeconds,
    recentResponseTimeSeconds: item.responseTimeSeconds,
    averageInstantScore,
    recentInstantScore: item.instantScore,
    recentIncorrect: !item.correct,
    lastAnsweredAt: item.answeredAt,
    masteryLevel: mastery(correct, total, averageInstantScore),
    fsrsCard: state.fsrsCard ?? null,
    nextReviewAt: state.nextReviewAt ?? null,
    fsrsStability: state.fsrsStability ?? 0,
    fsrsDifficulty: state.fsrsDifficulty ?? 0,
  };
};
export const rebuildQuestionStates = (
  history: StudyHistory[],
): QuestionState[] => {
  const map = new Map<string, QuestionState>();
  [...history]
    .sort((a, b) => a.answeredAt.localeCompare(b.answeredAt))
    .forEach((item) =>
      map.set(
        item.questionId,
        applyHistoryToState(map.get(item.questionId), item),
      ),
    );
  return [...map.values()];
};
export const loadQuestionStates = (
  history: StudyHistory[],
): QuestionState[] => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as QuestionState[];
    }
  } catch {
    /* rebuild */
  }
  const rebuilt = rebuildQuestionStates(history);
  saveQuestionStates(rebuilt);
  return rebuilt;
};
export const saveQuestionStates = (states: QuestionState[]): void =>
  localStorage.setItem(KEY, JSON.stringify(states));
export const updateQuestionStates = (
  states: QuestionState[],
  item: StudyHistory,
): QuestionState[] => {
  const existing = states.find((state) => state.questionId === item.questionId);
  const next = applyHistoryToState(existing, item);
  return existing
    ? states.map((state) =>
        state.questionId === item.questionId ? next : state,
      )
    : [...states, next];
};
export const getMasteryLabel = (level: MasteryLevel): string =>
  level === "MASTERED"
    ? "習得済み"
    : level === "LEARNING"
      ? "学習中"
      : "未学習";

