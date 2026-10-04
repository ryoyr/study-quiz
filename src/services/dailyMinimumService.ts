


import type { StudyHistory } from '../types/StudyHistory';

export interface DailyMinimumProgress {
  minimum: number;
  completed: number;
  remaining: number;
  rate: number;
  achieved: boolean;
}

const localDateKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const calculateDailyMinimumProgress = (
  history: StudyHistory[],
  minimum: number,
  now = new Date(),
): DailyMinimumProgress => {
  const normalizedMinimum = Math.max(1, Math.floor(minimum));
  const today = localDateKey(now);
  const completed = history.filter((item) => {
    const answeredAt = new Date(item.answeredAt);
    return !Number.isNaN(answeredAt.getTime()) && localDateKey(answeredAt) === today;
  }).length;
  return {
    minimum: normalizedMinimum,
    completed,
    remaining: Math.max(0, normalizedMinimum - completed),
    rate: Math.min(1, completed / normalizedMinimum),
    achieved: completed >= normalizedMinimum,
  };
};
