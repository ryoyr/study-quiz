import type { StudyHistory } from "../types/StudyHistory";
import type { MasteryLevel, QuestionState } from "../types/QuestionState";
import { STORAGE_KEYS } from "./storageKeyRegistry.ts";
import { writeStorageValue } from "./verifiedStorage.ts";
import { isStoredFsrsCard } from "./fsrsAdapter.ts";

const KEY = STORAGE_KEYS.questionStates;
const isTimestamp = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T/u.test(value) &&
  Number.isFinite(Date.parse(value));
const isFiniteNonNegative = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;
const isNonNegativeInteger = (value: unknown): value is number =>
  Number.isInteger(value) && Number(value) >= 0;

export const isQuestionState = (value: unknown): value is QuestionState => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const state = value as Partial<QuestionState>;
  return (
    typeof state.questionId === "string" &&
    state.questionId.trim().length > 0 &&
    state.questionId.length <= 200 &&
    isNonNegativeInteger(state.correctCount) &&
    isNonNegativeInteger(state.incorrectCount) &&
    isNonNegativeInteger(state.totalCount) &&
    state.correctCount + state.incorrectCount === state.totalCount &&
    isFiniteNonNegative(state.averageResponseTimeSeconds) &&
    isFiniteNonNegative(state.recentResponseTimeSeconds) &&
    isFiniteNonNegative(state.averageInstantScore) &&
    state.averageInstantScore <= 1 &&
    isFiniteNonNegative(state.recentInstantScore) &&
    state.recentInstantScore <= 1 &&
    typeof state.recentIncorrect === "boolean" &&
    (state.lastAnsweredAt === null || isTimestamp(state.lastAnsweredAt)) &&
    ["UNLEARNED", "LEARNING", "MASTERED"].includes(
      String(state.masteryLevel),
    ) &&
    (state.fsrsCard === null || isStoredFsrsCard(state.fsrsCard)) &&
    (state.nextReviewAt === null || isTimestamp(state.nextReviewAt)) &&
    isFiniteNonNegative(state.fsrsStability) &&
    isFiniteNonNegative(state.fsrsDifficulty)
  );
};
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
  now = new Date(),
): QuestionState[] => {
  const map = new Map<string, QuestionState>();
  history
    .map((item, index) => ({ item, index, time: Date.parse(item.answeredAt) }))
    .filter(({ time }) => Number.isFinite(time) && time <= now.getTime())
    .sort((left, right) => left.time - right.time || left.index - right.index)
    .forEach(({ item }) =>
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
      if (
        Array.isArray(parsed) &&
        parsed.length <= 100_000 &&
        parsed.every(isQuestionState) &&
        new Set(parsed.map((state) => state.questionId)).size === parsed.length &&
        (parsed.length > 0 || history.length === 0)
      )
        return parsed;
    }
  } catch {
    /* rebuild */
  }
  const rebuilt = rebuildQuestionStates(history);
  saveQuestionStates(rebuilt);
  return rebuilt;
};
export const saveQuestionStates = (states: QuestionState[]): void => {
  if (
    states.length > 100_000 ||
    !states.every(isQuestionState) ||
    new Set(states.map((state) => state.questionId)).size !== states.length
  )
    throw new Error("保存する問題状態・FSRSの形式が不正です。");
  writeStorageValue(KEY, JSON.stringify(states));
};
export const updateQuestionStates = (
  states: QuestionState[],
  item: StudyHistory,
): QuestionState[] => {
  const byQuestion = new Map(
    states.filter(isQuestionState).map((state) => [state.questionId, state]),
  );
  const existing = byQuestion.get(item.questionId);
  const next = applyHistoryToState(existing, item);
  byQuestion.set(item.questionId, next);
  return [...byQuestion.values()];
};
export const getMasteryLabel = (level: MasteryLevel): string =>
  level === "MASTERED"
    ? "習得済み"
    : level === "LEARNING"
      ? "学習中"
      : "未学習";
