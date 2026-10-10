import type { Question } from "../types/Question";
import type { MasteryLevel, QuestionState } from "../types/QuestionState";
import type { MasteryFilter, QuestionMode, Setup } from "../types/Setup";
import type { StudyHistory } from "../types/StudyHistory";
import type {
  GeneratedStudySession,
  SourceType,
  StudySessionItem,
} from "../types/StudySession";
import { analyzeWeakQuestions } from "./weakQuestionService.ts";
import {
  calculateRequiredNewCount,
  generateStudySession,
} from "./sessionGenerator.ts";
import { normalizeStudyCategories } from "./studyRangeService.ts";
import {
  normalizeMasteryFilters,
  normalizeQuestionModes,
} from "./studyOptionService.ts";

export interface StudySelection {
  examScopeId: string;
  /** ALLのみ、または選択した複数カテゴリ。 */
  categories: string[];
  /** ALLのみ、またはOR条件で扱う複数理解度。 */
  masteryFilters: MasteryFilter[];
  /** ALLのみ、または候補を和集合にする複数出題方法。 */
  questionModes: QuestionMode[];
  questionIds: string[];
}

export const selectionFromSetup = (setup: Setup): StudySelection => ({
  examScopeId: setup.examScopeId,
  categories: normalizeStudyCategories(
    setup.defaultCategories,
    setup.defaultCategory,
  ),
  masteryFilters: normalizeMasteryFilters(
    setup.defaultMasteryFilters,
    setup.defaultMasteryFilter,
  ),
  questionModes: normalizeQuestionModes(
    setup.defaultQuestionModes,
    setup.defaultQuestionMode,
  ),
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
  const selectedCategories = new Set(
    normalizeStudyCategories(selection.categories),
  );
  const selectedMastery = new Set(
    normalizeMasteryFilters(selection.masteryFilters),
  );
  return questions.filter(
    (question) =>
      !question.archivedAt &&
      question.examScopeId === selection.examScopeId &&
      (selectedCategories.has("ALL") ||
        selectedCategories.has(question.category)) &&
      (selectedMastery.has("ALL") ||
        selectedMastery.has(masteryForQuestion(question.id, states))) &&
      (selectedIds.size === 0 || selectedIds.has(question.id)),
  );
};

const primarySource = (sourceTypes: readonly SourceType[]): SourceType => {
  if (sourceTypes.includes("REVIEW")) return "REVIEW";
  if (sourceTypes.includes("WEAK")) return "WEAK";
  if (sourceTypes.includes("NEW")) return "NEW";
  return "CUSTOM";
};

const sourceOrder: SourceType[] = ["REVIEW", "WEAK", "NEW", "CUSTOM"];
const maximumWeight = (questions: Question[]): number =>
  questions.reduce((maximum, question) => Math.max(maximum, question.weight), 1);

const createSession = (
  items: StudySessionItem[],
  remainingNewQuestions: number,
  effectiveDays: number,
  requiredNewCount: number,
  now: Date,
): GeneratedStudySession => {
  const selected = items.map((item, index) => ({ ...item, order: index + 1 }));
  return {
    id: crypto.randomUUID(),
    createdAt: now.toISOString(),
    items: selected,
    newCount: selected.filter((item) => item.primarySourceType === "NEW").length,
    reviewCount: selected.filter(
      (item) => item.primarySourceType === "REVIEW",
    ).length,
    weakCount: selected.filter((item) => item.primarySourceType === "WEAK")
      .length,
    otherCount: selected.filter(
      (item) => item.primarySourceType === "CUSTOM",
    ).length,
    totalCount: selected.length,
    estimatedMinutes: selected.length === 0 ? 0 : Math.ceil(selected.length * 0.75),
    remainingNewQuestions,
    effectiveDays,
    requiredNewCount,
  };
};

const customSession = (
  questions: Question[],
  setup: Setup,
  history: StudyHistory[],
  now: Date,
): GeneratedStudySession => {
  const answered = new Set(history.map((item) => item.questionId));
  const remainingNewQuestions = questions.filter(
    (question) => !answered.has(question.id),
  ).length;
  const { effectiveDays, requiredNewCount } = calculateRequiredNewCount(
    remainingNewQuestions,
    setup,
    now,
  );
  const maxWeight = maximumWeight(questions);
  const items = [...questions]
    .sort(
      (left, right) =>
        right.weight - left.weight || left.id.localeCompare(right.id),
    )
    .slice(0, setup.dailyQuestionLimit)
    .map<StudySessionItem>((question, index) => ({
      order: index + 1,
      question,
      primarySourceType: "CUSTOM",
      sourceTypes: ["CUSTOM"],
      priorityScore: Math.min(1, Math.max(0.1, question.weight / maxWeight)),
    }));
  return createSession(
    items,
    remainingNewQuestions,
    effectiveDays,
    requiredNewCount,
    now,
  );
};

const generateMultiModeSession = (
  pool: Question[],
  history: StudyHistory[],
  setup: Setup,
  states: QuestionState[],
  modes: QuestionMode[],
  now: Date,
): GeneratedStudySession => {
  const answered = new Set(history.map((item) => item.questionId));
  const newQuestions = pool.filter((question) => !answered.has(question.id));
  const { effectiveDays, requiredNewCount } = calculateRequiredNewCount(
    newQuestions.length,
    setup,
    now,
  );
  const maxWeight = maximumWeight(pool);
  const weakScores = new Map(
    analyzeWeakQuestions(pool, history)
      .filter((item) => item.weaknessScore >= 0.35)
      .map((item) => [item.question.id, item.weaknessScore]),
  );
  const candidates = new Map<
    string,
    { question: Question; sourceTypes: Set<SourceType>; priorityScore: number }
  >();
  const statesByQuestion = new Map(
    states.map((state) => [state.questionId, state]),
  );
  const add = (
    question: Question,
    sources: readonly SourceType[],
    priorityScore: number,
  ) => {
    const current = candidates.get(question.id) ?? {
      question,
      sourceTypes: new Set<SourceType>(),
      priorityScore: 0,
    };
    sources.forEach((source) => current.sourceTypes.add(source));
    current.priorityScore = Math.max(current.priorityScore, priorityScore);
    candidates.set(question.id, current);
  };

  if (modes.includes("ADAPTIVE")) {
    generateStudySession(pool, history, setup, states, now).items.forEach((item) =>
      add(item.question, item.sourceTypes, item.priorityScore),
    );
  }
  if (modes.includes("NEW")) {
    newQuestions.forEach((question) =>
      add(question, ["NEW"], 0.5 + question.weight / maxWeight / 4),
    );
  }
  if (modes.includes("REVIEW")) {
    pool.forEach((question) => {
      const due = statesByQuestion.get(question.id)?.nextReviewAt;
      const dueAt = due ? Date.parse(due) : NaN;
      if (Number.isFinite(dueAt) && dueAt <= now.getTime()) {
        const overdueDays = Math.max(
          0,
          Math.floor((now.getTime() - dueAt) / 86_400_000),
        );
        add(question, ["REVIEW"], Math.min(1, 0.8 + overdueDays / 100));
      }
    });
  }
  if (modes.includes("WEAK")) {
    pool.forEach((question) => {
      const score = weakScores.get(question.id);
      if (score !== undefined)
        add(question, ["WEAK"], Math.min(1, 0.7 + score / 4));
    });
  }

  const items = [...candidates.values()]
    .map<StudySessionItem>((candidate) => {
      const sources = sourceOrder.filter((source) =>
        candidate.sourceTypes.has(source),
      );
      return {
        order: 0,
        question: candidate.question,
        primarySourceType: primarySource(sources),
        sourceTypes: sources,
        priorityScore: candidate.priorityScore,
      };
    })
    .sort(
      (left, right) =>
        right.priorityScore - left.priorityScore ||
        sourceOrder.indexOf(left.primarySourceType) -
          sourceOrder.indexOf(right.primarySourceType) ||
        right.question.weight - left.question.weight ||
        left.question.id.localeCompare(right.question.id),
    )
    .slice(0, setup.dailyQuestionLimit);

  return createSession(
    items,
    newQuestions.length,
    effectiveDays,
    requiredNewCount,
    now,
  );
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
  if (selection.questionIds.length > 0)
    return customSession(pool, setup, history, now);

  const modes = normalizeQuestionModes(selection.questionModes);
  if (modes.includes("ALL")) return customSession(pool, setup, history, now);
  if (modes.length === 1 && modes[0] === "ADAPTIVE")
    return generateStudySession(pool, history, setup, states, now);

  return generateMultiModeSession(pool, history, setup, states, modes, now);
};
