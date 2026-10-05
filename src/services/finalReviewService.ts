import type { Question } from "../types/Question";
import type { QuestionState } from "../types/QuestionState";
import type { StudyHistory } from "../types/StudyHistory";
import { detectForgettingCandidates } from "./forgettingDetectionService";
import { analyzeWeakQuestions } from "./weakQuestionService";
export type FinalReviewStrategy = "NORMAL" | "BALANCED" | "FINAL" | "CRAM";
export interface FinalReviewPlan {
  questions: Question[];
  highWeightCount: number;
  weakCount: number;
  forgettingCount: number;
  unlearnedCount: number;
  estimatedMinutes: number;
  strategy: FinalReviewStrategy;
  strategyLabel: string;
  strategyDescription: string;
}
const strategyFor = (days: number) => {
  if (days <= 3)
    return {
      strategy: "CRAM" as const,
      label: "直前総仕上げ",
      description: "新規を抑え、忘れかけ・弱点・高ウェイトを最優先",
      weights: { forgetting: 0.4, weak: 0.3, weight: 0.25, unlearned: 0.05 },
    };
  if (days <= 14)
    return {
      strategy: "FINAL" as const,
      label: "直前対策",
      description: "忘れかけと弱点を中心に重要問題を反復",
      weights: { forgetting: 0.35, weak: 0.3, weight: 0.25, unlearned: 0.1 },
    };
  if (days <= 30)
    return {
      strategy: "BALANCED" as const,
      label: "仕上げ移行",
      description: "未習得を残しつつ弱点・重要問題の比率を上げる",
      weights: { forgetting: 0.2, weak: 0.3, weight: 0.25, unlearned: 0.25 },
    };
  return {
    strategy: "NORMAL" as const,
    label: "通常学習",
    description: "未習得を進めながら弱点・期限問題を混合",
    weights: { forgetting: 0.15, weak: 0.2, weight: 0.2, unlearned: 0.45 },
  };
};
export const createFinalReviewPlan = (
  questions: Question[],
  history: StudyHistory[],
  questionStates: QuestionState[],
  remainingDays: number,
  limit = 20,
): FinalReviewPlan => {
  const strategy = strategyFor(Math.max(0, remainingDays));
  const weakIds = new Set(
    analyzeWeakQuestions(questions, history)
      .filter((item) => item.weaknessScore >= 0.35)
      .map((item) => item.question.id),
  );
  const forgettingIds = new Set(
    detectForgettingCandidates(questions, history).map(
      (item) => item.question.id,
    ),
  );
  const answeredIds = new Set(history.map((item) => item.questionId));
  const mastery = new Map(
    questionStates.map((state) => [state.questionId, state.masteryLevel]),
  );
  const maxWeight = Math.max(
    1,
    ...questions.map((question) => question.weight),
  );
  const selected = [...questions]
    .map((question) => {
      const weight = question.weight / maxWeight;
      const weak = weakIds.has(question.id) ? 1 : 0;
      const forgetting = forgettingIds.has(question.id) ? 1 : 0;
      const unlearned =
        !answeredIds.has(question.id) ||
        mastery.get(question.id) === "UNLEARNED"
          ? 1
          : 0;
      const w = strategy.weights;
      return {
        question,
        score:
          forgetting * w.forgetting +
          weak * w.weak +
          weight * w.weight +
          unlearned * w.unlearned,
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.question.weight - a.question.weight ||
        a.question.id.localeCompare(b.question.id),
    )
    .slice(0, Math.max(1, limit))
    .map((item) => item.question);
  return {
    questions: selected,
    highWeightCount: selected.filter(
      (question) => question.weight >= Math.max(3, maxWeight),
    ).length,
    weakCount: selected.filter((question) => weakIds.has(question.id)).length,
    forgettingCount: selected.filter((question) =>
      forgettingIds.has(question.id),
    ).length,
    unlearnedCount: selected.filter((question) => !answeredIds.has(question.id))
      .length,
    estimatedMinutes: Math.max(1, Math.ceil(selected.length * 0.75)),
    strategy: strategy.strategy,
    strategyLabel: strategy.label,
    strategyDescription: strategy.description,
  };
};
