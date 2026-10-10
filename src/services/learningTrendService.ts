import type { Question } from "../types/Question";
import type { QuestionState } from "../types/QuestionState";
import type { StudyHistory } from "../types/StudyHistory";
import { applyHistoryToState } from "./questionStateService.ts";

export interface LearningTrendPoint {
  date: string;
  label: string;
  answers: number;
  unlearned: number;
  learning: number;
  mastered: number;
}

const localDate = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const buildLearningTrend = (
  history: StudyHistory[],
  questions: Question[],
  days = 14,
  now = new Date(),
): LearningTrendPoint[] => {
  const periodDays = Number.isInteger(days)
    ? Math.min(3660, Math.max(1, days))
    : 14;
  const nowTime = now.getTime();
  const activeIds = new Set(
    questions.filter((question) => !question.archivedAt).map((question) => question.id),
  );
  const dates = Array.from({ length: periodDays }, (_, offset) => {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (periodDays - 1 - offset));
    return localDate(date);
  });
  const dateSet = new Set(dates);
  const states = new Map<string, QuestionState>();
  const answers = new Map(dates.map((date) => [date, 0]));
  const byDay = new Map<string, StudyHistory[]>();

  history
    .map((item, index) => ({ item, index, time: Date.parse(item.answeredAt) }))
    .filter(
      ({ item, time }) =>
        activeIds.has(item.questionId) &&
        Number.isFinite(time) &&
        time <= nowTime,
    )
    .sort((left, right) => left.time - right.time || left.index - right.index)
    .forEach(({ item, time }) => {
      const date = localDate(new Date(time));
      if (!byDay.has(date)) byDay.set(date, []);
      byDay.get(date)?.push(item);
      if (dateSet.has(date)) answers.set(date, (answers.get(date) ?? 0) + 1);
    });

  const firstDate = dates[0];
  [...byDay.entries()]
    .filter(([date]) => date < firstDate)
    .flatMap(([, items]) => items)
    .sort(
      (left, right) =>
        Date.parse(left.answeredAt) - Date.parse(right.answeredAt) ||
        left.id.localeCompare(right.id),
    )
    .forEach((item) => states.set(item.questionId, applyHistoryToState(states.get(item.questionId), item)));

  return dates.map((date) => {
    (byDay.get(date) ?? []).forEach((item) =>
      states.set(item.questionId, applyHistoryToState(states.get(item.questionId), item)),
    );
    let learning = 0;
    let mastered = 0;
    activeIds.forEach((id) => {
      const level = states.get(id)?.masteryLevel ?? "UNLEARNED";
      if (level === "MASTERED") mastered += 1;
      else if (level === "LEARNING") learning += 1;
    });
    const [, month, day] = date.split("-");
    return {
      date,
      label: `${Number(month)}/${Number(day)}`,
      answers: answers.get(date) ?? 0,
      unlearned: Math.max(0, activeIds.size - learning - mastered),
      learning,
      mastered,
    };
  });
};
