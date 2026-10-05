import type { Question } from "../types/Question";
import type { StudyHistory } from "../types/StudyHistory";
const KEY = "study-quiz-daily-time-budget-v1";
export interface DailyTimeBudget {
  limitMinutes: number;
  usedSeconds: number;
  remainingSeconds: number;
  rate: number;
  reached: boolean;
}
const localDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const loadDailyTimeLimit = (): number => {
  const value = Number(localStorage.getItem(KEY) ?? 0);
  return Number.isFinite(value) && value >= 0 ? value : 0;
};
export const saveDailyTimeLimit = (minutes: number): number => {
  const value = Math.max(0, Math.min(480, Math.floor(minutes)));
  localStorage.setItem(KEY, String(value));
  return value;
};
export const calculateDailyTimeBudget = (
  history: StudyHistory[],
  limitMinutes: number,
  now = new Date(),
): DailyTimeBudget => {
  const today = localDate(now);
  const usedSeconds = history
    .filter((item) => {
      const date = new Date(item.answeredAt);
      return !Number.isNaN(date.getTime()) && localDate(date) === today;
    })
    .reduce((sum, item) => sum + Math.max(0, item.responseTimeSeconds), 0);
  const limitSeconds = limitMinutes * 60;
  return {
    limitMinutes,
    usedSeconds,
    remainingSeconds:
      limitMinutes === 0
        ? Number.POSITIVE_INFINITY
        : Math.max(0, limitSeconds - usedSeconds),
    rate: limitMinutes === 0 ? 0 : Math.min(1, usedSeconds / limitSeconds),
    reached: limitMinutes > 0 && usedSeconds >= limitSeconds,
  };
};
export const fitQuestionsToTimeBudget = (
  questions: Question[],
  budget: DailyTimeBudget,
  estimatedSecondsPerQuestion = 45,
): Question[] =>
  budget.limitMinutes === 0
    ? questions
    : questions.slice(
        0,
        Math.max(
          0,
          Math.floor(budget.remainingSeconds / estimatedSecondsPerQuestion),
        ),
      );
