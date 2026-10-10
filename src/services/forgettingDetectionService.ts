import type { Question } from "../types/Question";
import type { StudyHistory } from "../types/StudyHistory";

export interface ForgettingCandidate {
  question: Question;
  score: number;
  reasons: string[];
  recentAccuracy: number;
  previousAccuracy: number;
  recentAverageSeconds: number;
  previousAverageSeconds: number;
  recentInstantScore: number;
  previousInstantScore: number;
}

const average = (values: number[]): number =>
  values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length;

const accuracy = (items: StudyHistory[]): number =>
  items.length === 0
    ? 0
    : items.filter((item) => item.correct).length / items.length;

export const detectForgettingCandidates = (
  questions: Question[],
  history: StudyHistory[],
  now = new Date(),
): ForgettingCandidate[] => {
  const nowTime = now.getTime();
  return questions
    .filter((question) => !question.archivedAt)
    .map((question): ForgettingCandidate | null => {
      const answers = history
        .map((item, index) => ({ item, index, time: Date.parse(item.answeredAt) }))
        .filter(
          ({ item, time }) =>
            item.questionId === question.id &&
            Number.isFinite(time) &&
            time <= nowTime,
        )
        .sort((left, right) => right.time - left.time || left.index - right.index)
        .map(({ item }) => item);
      if (answers.length < 4) return null;
      const recentSize = Math.min(3, Math.floor(answers.length / 2));
      const recent = answers.slice(0, recentSize);
      const previous = answers.slice(recentSize);
      if (previous.length < 2) return null;

      const recentAccuracy = accuracy(recent);
      const previousAccuracy = accuracy(previous);
      const recentAverageSeconds = average(
        recent.map((item) => item.responseTimeSeconds),
      );
      const previousAverageSeconds = average(
        previous.map((item) => item.responseTimeSeconds),
      );
      const recentInstantScore = average(
        recent.map((item) => item.instantScore),
      );
      const previousInstantScore = average(
        previous.map((item) => item.instantScore),
      );

      const accuracyDrop = Math.max(0, previousAccuracy - recentAccuracy);
      const responseIncrease =
        previousAverageSeconds > 0
          ? Math.max(0, recentAverageSeconds / previousAverageSeconds - 1)
          : 0;
      const instantDrop = Math.max(
        0,
        previousInstantScore - recentInstantScore,
      );
      const reasons: string[] = [];
      if (accuracyDrop >= 0.2) reasons.push("正答率が低下");
      if (
        responseIncrease >= 0.3 &&
        recentAverageSeconds - previousAverageSeconds >= 2
      )
        reasons.push("回答時間が増加");
      if (instantDrop >= 0.2) reasons.push("即答スコアが低下");
      if (reasons.length === 0) return null;

      const score = Math.min(
        1,
        accuracyDrop * 0.5 +
          Math.min(1, responseIncrease) * 0.25 +
          instantDrop * 0.25,
      );
      return {
        question,
        score,
        reasons,
        recentAccuracy,
        previousAccuracy,
        recentAverageSeconds,
        previousAverageSeconds,
        recentInstantScore,
        previousInstantScore,
      };
    })
    .filter((item): item is ForgettingCandidate => item !== null)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.question.weight - a.question.weight ||
        a.question.id.localeCompare(b.question.id),
    );
};

export const selectForgettingQuestions = (
  questions: Question[],
  history: StudyHistory[],
  limit: number,
): Question[] =>
  detectForgettingCandidates(questions, history)
    .slice(0, Math.max(0, Math.floor(limit)))
    .map((item) => item.question);
