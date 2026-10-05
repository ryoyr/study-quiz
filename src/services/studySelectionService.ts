import type { Question } from "../types/Question";
import type { MasteryLevel, QuestionState } from "../types/QuestionState";
import type { Setup, MasteryFilter, QuestionMode } from "../types/Setup";
import type { StudyHistory } from "../types/StudyHistory";
import type { GeneratedStudySession, SourceType } from "../types/StudySession";
import { analyzeWeakQuestions } from "./weakQuestionService.ts";
import { generateStudySession } from "./sessionGenerator.ts";
import { normalizeStudyCategories } from "./studyRangeService.ts";

export interface StudySelection {
  examScopeId: string;
  /** ALLのみ、または選択した複数カテゴリ。 */
  categories: string[];
  masteryFilter: MasteryFilter;
  questionMode: QuestionMode;
  questionIds: string[];
}

export const selectionFromSetup = (setup: Setup): StudySelection => ({
  examScopeId: setup.examScopeId,
  categories: normalizeStudyCategories(setup.defaultCategories, setup.defaultCategory),
  masteryFilter: setup.defaultMasteryFilter,
  questionMode: setup.defaultQuestionMode,
  questionIds: [...setup.defaultQuestionIds],
});

export const masteryForQuestion = (
  questionId: string,
  states: QuestionState[],
): MasteryLevel =>
  states.find((state) => state.questionId === questionId)?.masteryLevel ??
  "UNLEARNED";

export const filterStudyQuestions = (
  questions: Question[],
  states: QuestionState[],
  selection: StudySelection,
): Question[] => {
  const selectedIds = new Set(selection.questionIds);
  const selectedCategories = new Set(normalizeStudyCategories(selection.categories));
  return questions.filter((question) =>
    question.examScopeId === selection.examScopeId &&
    (selectedCategories.has("ALL") || selectedCategories.has(question.category)) &&
    (selection.masteryFilter === "ALL" || masteryForQuestion(question.id, states) === selection.masteryFilter) &&
    (selectedIds.size === 0 || selectedIds.has(question.id)),
  );
};

const manualSession = (
  questions: Question[],
  source: SourceType,
  setup: Setup,
  now: Date,
): GeneratedStudySession => {
  const selected = [...questions]
    .sort((left, right) => right.weight - left.weight || left.id.localeCompare(right.id))
    .slice(0, setup.dailyQuestionLimit);
  return {
    id: crypto.randomUUID(),
    createdAt: now.toISOString(),
    items: selected.map((question, index) => ({
      order: index + 1,
      question,
      primarySourceType: source,
      sourceTypes: [source],
      priorityScore: Math.min(1, Math.max(0.1, question.weight / 5)),
    })),
    newCount: source === "NEW" ? selected.length : 0,
    reviewCount: source === "REVIEW" ? selected.length : 0,
    weakCount: source === "WEAK" ? selected.length : 0,
    otherCount: source === "CUSTOM" ? selected.length : 0,
    totalCount: selected.length,
    estimatedMinutes: Math.max(1, Math.ceil(selected.length * 0.75)),
    remainingNewQuestions: 0,
    effectiveDays: 1,
    requiredNewCount: source === "NEW" ? selected.length : 0,
  };
};

export const generateSelectedStudySession = (
  questions: Question[],
  history: StudyHistory[],
  setup: Setup,
  states: QuestionState[],
  selection: StudySelection,
  now = new Date(),
): GeneratedStudySession => {
  const pool = filterStudyQuestions(questions, states, selection);
  if (selection.questionIds.length > 0) return manualSession(pool, "CUSTOM", setup, now);
  if (selection.questionMode === "ADAPTIVE")
    return generateStudySession(pool, history, setup, states, now);

  const answered = new Set(history.map((item) => item.questionId));
  if (selection.questionMode === "NEW")
    return manualSession(pool.filter((question) => !answered.has(question.id)), "NEW", setup, now);
  if (selection.questionMode === "REVIEW") {
    return manualSession(
      pool.filter((question) => {
        const due = states.find((state) => state.questionId === question.id)?.nextReviewAt;
        return Boolean(due && new Date(due).getTime() <= now.getTime());
      }),
      "REVIEW",
      setup,
      now,
    );
  }
  if (selection.questionMode === "WEAK") {
    const weakIds = new Set(
      analyzeWeakQuestions(pool, history)
        .filter((item) => item.weaknessScore >= 0.35)
        .map((item) => item.question.id),
    );
    return manualSession(pool.filter((question) => weakIds.has(question.id)), "WEAK", setup, now);
  }
  return manualSession(pool, "CUSTOM", setup, now);
};
