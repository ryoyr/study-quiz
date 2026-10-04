

import type { Setup } from "../types/Setup";
import type { SessionPlan } from "../types/Session";

export const createTodaySession = (
  setup: Setup,
): SessionPlan => {
  const newQuestions =
    setup.dailyNewLimit;

  const totalQuestions =
    setup.dailyQuestionLimit;

  const reviewQuestions =
    Math.max(
      0,
      totalQuestions - newQuestions,
    );

  return {
    newQuestions,
    reviewQuestions,
    totalQuestions,
  };
};
