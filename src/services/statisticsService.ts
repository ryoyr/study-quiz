import type { StudyHistory } from "../types/StudyHistory";

export type StatisticsPeriod = "TODAY" | "DAYS_7" | "DAYS_30" | "ALL";

export interface CategoryStatistics {
  category: string;
  answers: number;
  correctAnswers: number;
  accuracyRate: number;
  averageResponseTimeSeconds: number;
  averageInstantScore: number;
}

export interface StudyStatistics {
  totalAnswers: number;
  correctAnswers: number;
  accuracyRate: number;
  averageResponseTimeSeconds: number;
  averageInstantScore: number;
  instantAnswerRate: number;
  categories: CategoryStatistics[];
}

const average = (values: number[]): number =>
  values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length;

const localDayStart = (date: Date): Date => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

export const filterHistoryByPeriod = (
  history: StudyHistory[],
  period: StatisticsPeriod,
  now = new Date(),
): StudyHistory[] => {
  if (period === "ALL") return history;
  const start = localDayStart(now);
  if (period === "DAYS_7") start.setDate(start.getDate() - 6);
  if (period === "DAYS_30") start.setDate(start.getDate() - 29);
  const startTime = start.getTime();
  return history.filter((item) => {
    const answeredAt = new Date(item.answeredAt).getTime();
    return Number.isFinite(answeredAt) && answeredAt >= startTime;
  });
};

export const calculateStatistics = (
  history: StudyHistory[],
  thresholdSeconds: number,
): StudyStatistics => {
  const correctAnswers = history.filter((item) => item.correct).length;
  const groups = new Map<string, StudyHistory[]>();
  history.forEach((item) =>
    groups.set(item.category, [...(groups.get(item.category) ?? []), item]),
  );
  const categories = [...groups.entries()]
    .map(([category, items]) => {
      const categoryCorrect = items.filter((item) => item.correct).length;
      return {
        category,
        answers: items.length,
        correctAnswers: categoryCorrect,
        accuracyRate: items.length ? categoryCorrect / items.length : 0,
        averageResponseTimeSeconds: average(
          items.map((item) => item.responseTimeSeconds),
        ),
        averageInstantScore: average(items.map((item) => item.instantScore)),
      };
    })
    .sort((a, b) => a.category.localeCompare(b.category, "ja"));
  return {
    totalAnswers: history.length,
    correctAnswers,
    accuracyRate: history.length ? correctAnswers / history.length : 0,
    averageResponseTimeSeconds: average(
      history.map((item) => item.responseTimeSeconds),
    ),
    averageInstantScore: average(history.map((item) => item.instantScore)),
    instantAnswerRate: history.length
      ? history.filter(
          (item) => item.correct && item.responseTimeSeconds < thresholdSeconds,
        ).length / history.length
      : 0,
    categories,
  };
};

export const calculateStatisticsForPeriod = (
  history: StudyHistory[],
  thresholdSeconds: number,
  period: StatisticsPeriod,
  now = new Date(),
): StudyStatistics =>
  calculateStatistics(
    filterHistoryByPeriod(history, period, now),
    thresholdSeconds,
  );
