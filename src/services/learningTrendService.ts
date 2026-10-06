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
  const activeIds = new Set(
    questions.filter((question) => !question.archivedAt).map((question) => question.id),
  );
  const dates = Array.from({ length: Math.max(1, days) }, (_, offset) => {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (Math.max(1, days) - 1 - offset));
    return localDate(date);
  });
  const dateSet = new Set(dates);
  const states = new Map<string, QuestionState>();
  const answers = new Map(dates.map((date) => [date, 0]));
  const byDay = new Map<string, StudyHistory[]>();

  [...history]
    .filter((item) => activeIds.has(item.questionId))
    .sort((left, right) => left.answeredAt.localeCompare(right.answeredAt))
    .forEach((item) => {
      const date = localDate(new Date(item.answeredAt));
      if (!byDay.has(date)) byDay.set(date, []);
      byDay.get(date)?.push(item);
      if (dateSet.has(date)) answers.set(date, (answers.get(date) ?? 0) + 1);
    });

  const firstDate = dates[0];
  [...byDay.entries()]
    .filter(([date]) => date < firstDate)
    .flatMap(([, items]) => items)
    .sort((left, right) => left.answeredAt.localeCompare(right.answeredAt))
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

