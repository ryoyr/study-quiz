

import type { Question } from '../types/Question';
import type { QuestionState } from '../types/QuestionState';
import type { StudyHistory } from '../types/StudyHistory';

export type ProgressPaceStatus = 'AHEAD' | 'ON_TRACK' | 'BEHIND' | 'NO_DATA';

export interface ProgressForecast {
  requiredDailyPace: number;
  recentDailyPace: number;
  paceDifference: number;
  status: ProgressPaceStatus;
  activeDays: number;
  highWeightMasteryRate: number;
  highWeightQuestionCount: number;
  weakQuestionCount: number;
}

const localDate = (value: string): string => {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export const calculateProgressForecast = (
  questions: Question[],
  history: StudyHistory[],
  questionStates: QuestionState[],
  remainingNewQuestions: number,
  effectiveDays: number,
  bufferRatePercent: number,
  now = new Date(),
): ProgressForecast => {
  const requiredDailyPace = remainingNewQuestions === 0
    ? 0
    : Math.ceil((remainingNewQuestions / Math.max(1, effectiveDays)) * (1 + bufferRatePercent / 100));

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 6);
  const recentHistory = history.filter((item) => new Date(item.answeredAt).getTime() >= start.getTime());
  const activeDays = new Set(recentHistory.map((item) => localDate(item.answeredAt))).size;
  const recentDailyPace = activeDays === 0 ? 0 : Math.round((recentHistory.length / activeDays) * 10) / 10;
  const paceDifference = Math.round((recentDailyPace - requiredDailyPace) * 10) / 10;

  let status: ProgressPaceStatus = 'NO_DATA';
  if (activeDays > 0) {
    if (paceDifference >= 1) status = 'AHEAD';
    else if (paceDifference >= 0) status = 'ON_TRACK';
    else status = 'BEHIND';
  }

  const weightThreshold = questions.length === 0 ? 0 : Math.max(3, ...questions.map((question) => question.weight));
  const highWeightQuestions = questions.filter((question) => question.weight >= weightThreshold);
  const masteredIds = new Set(questionStates.filter((state) => state.masteryLevel === 'MASTERED').map((state) => state.questionId));
  const highWeightMastered = highWeightQuestions.filter((question) => masteredIds.has(question.id)).length;
  const highWeightMasteryRate = highWeightQuestions.length === 0 ? 0 : highWeightMastered / highWeightQuestions.length;
  const weakQuestionCount = questionStates.filter((state) => state.totalCount > 0 && state.masteryLevel !== 'MASTERED').length;

  return {
    requiredDailyPace,
    recentDailyPace,
    paceDifference,
    status,
    activeDays,
    highWeightMasteryRate,
    highWeightQuestionCount: highWeightQuestions.length,
    weakQuestionCount,
  };
};
