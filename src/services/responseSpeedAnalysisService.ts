import type { Question } from "../types/Question";
import type { StudyHistory } from "../types/StudyHistory";
export interface QuestionSpeedAnalysis {
  question: Question;
  attempts: number;
  accuracy: number;
  averageSeconds: number;
  recentAverageSeconds: number;
  responseDeltaSeconds: number;
  averageInstantScore: number;
  recentInstantScore: number;
  instantDelta: number;
  needsReview: boolean;
}
const avg = (values: number[]) =>
  values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
export const analyzeResponseSpeed = (
  questions: Question[],
  history: StudyHistory[],
): QuestionSpeedAnalysis[] =>
  questions
    .map((question) => {
      const attempts = history
        .filter((item) => item.questionId === question.id)
        .sort((a, b) => b.answeredAt.localeCompare(a.answeredAt));
      const recent = attempts.slice(0, Math.min(3, attempts.length));
      const averageSeconds = avg(
        attempts.map((item) => item.responseTimeSeconds),
      );
      const recentAverageSeconds = avg(
        recent.map((item) => item.responseTimeSeconds),
      );
      const averageInstantScore = avg(
        attempts.map((item) => item.instantScore),
      );
      const recentInstantScore = avg(recent.map((item) => item.instantScore));
      const responseDeltaSeconds = recentAverageSeconds - averageSeconds;
      const instantDelta = recentInstantScore - averageInstantScore;
      return {
        question,
        attempts: attempts.length,
        accuracy: attempts.length
          ? attempts.filter((item) => item.correct).length / attempts.length
          : 0,
        averageSeconds,
        recentAverageSeconds,
        responseDeltaSeconds,
        averageInstantScore,
        recentInstantScore,
        instantDelta,
        needsReview:
          attempts.length >= 3 &&
          (responseDeltaSeconds >= 2 || instantDelta <= -0.15),
      };
    })
    .filter((item) => item.attempts > 0)
    .sort(
      (a, b) =>
        Number(b.needsReview) - Number(a.needsReview) ||
        b.responseDeltaSeconds - a.responseDeltaSeconds ||
        a.question.id.localeCompare(b.question.id),
    );
export const selectSlowQuestions = (
  items: QuestionSpeedAnalysis[],
  limit: number,
) =>
  items
    .filter((item) => item.needsReview)
    .slice(0, Math.max(1, limit))
    .map((item) => item.question);
