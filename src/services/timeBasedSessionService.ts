import type { Question } from "../types/Question";
import type { StudySessionItem } from "../types/StudySession";
export interface TimeBasedSessionPlan {
  minutes: number;
  estimatedSecondsPerQuestion: number;
  questionLimit: number;
  questions: Question[];
  estimatedMinutes: number;
}
export const createTimeBasedSessionPlan = (
  items: StudySessionItem[],
  minutes: number,
  secondsPerQuestion = 45,
): TimeBasedSessionPlan => {
  const normalizedMinutes = Math.max(1, Math.floor(minutes));
  const normalizedSeconds = Math.max(1, Math.floor(secondsPerQuestion));
  const questionLimit = Math.max(
    1,
    Math.floor((normalizedMinutes * 60) / normalizedSeconds),
  );
  const questions = items.slice(0, questionLimit).map((item) => item.question);
  return {
    minutes: normalizedMinutes,
    estimatedSecondsPerQuestion: normalizedSeconds,
    questionLimit,
    questions,
    estimatedMinutes: Math.max(
      1,
      Math.ceil((questions.length * normalizedSeconds) / 60),
    ),
  };
};
