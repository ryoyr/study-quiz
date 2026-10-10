import type { Question } from "../types/Question";
import type { Setup } from "../types/Setup";
import type { StudyHistory } from "../types/StudyHistory";
import type { QuestionState } from "../types/QuestionState";
import type {
  GeneratedStudySession,
  SourceType,
  StudySessionItem,
} from "../types/StudySession";
import { analyzeWeakQuestions } from "./weakQuestionService.ts";
import { getEffectiveReservedDates } from "./reservedDayService.ts";
import {
  differenceInCalendarDays,
  formatLocalDate,
} from "./localDateService.ts";
type Candidate = {
  question: Question;
  sourceTypes: Set<SourceType>;
  weaknessScore: number;
  dueScore: number;
  newScore: number;
  priorityScore: number;
  lastAnsweredAt: string;
};
const clamp = (v: number) => Math.min(1, Math.max(0, v));
const timestamp = (value: string): number => Date.parse(value);
const validHistoryAt = (value: string, now: Date): boolean => {
  const time = timestamp(value);
  return Number.isFinite(time) && time <= now.getTime();
};
const maximumWeight = (questions: Question[]): number =>
  questions.reduce((maximum, question) => Math.max(maximum, question.weight), 1);
const countFutureReservedDates = (setup: Setup, now: Date) => {
  const today = formatLocalDate(now);
  const reservedDates = getEffectiveReservedDates(setup, now);
  return reservedDates.length === 0
    ? 0
    : reservedDates.filter(
        (date) => date >= today && date < setup.examDate,
      ).length;
};
export const calculateRequiredNewCount = (
  remaining: number,
  setup: Setup,
  now = new Date(),
) => {
  const effectiveDays = Math.max(
    1,
    differenceInCalendarDays(setup.examDate, now) -
      countFutureReservedDates(setup, now),
  );
  if (remaining === 0) return { effectiveDays, requiredNewCount: 0 };
  const base = Math.ceil(remaining / effectiveDays);
  const requiredNewCount = Math.min(
    remaining,
    setup.dailyNewLimit,
    Math.ceil(base * (1 + setup.bufferRate / 100)),
  );
  return { effectiveDays, requiredNewCount };
};
export const generateStudySession = (
  questions: Question[],
  history: StudyHistory[],
  setup: Setup,
  questionStates: QuestionState[] = [],
  now = new Date(),
): GeneratedStudySession => {
  const activeQuestions = questions.filter((question) => !question.archivedAt);
  const validHistory = history.filter((item) => validHistoryAt(item.answeredAt, now));
  const byQuestion = new Map<string, StudyHistory[]>();
  validHistory.forEach((item) => {
    const items = byQuestion.get(item.questionId);
    if (items) items.push(item);
    else byQuestion.set(item.questionId, [item]);
  });
  byQuestion.forEach((items) =>
    items.sort(
      (left, right) =>
        timestamp(right.answeredAt) - timestamp(left.answeredAt) ||
        left.id.localeCompare(right.id),
    ),
  );
  const newQuestions = activeQuestions.filter((q) => !byQuestion.has(q.id));
  const { effectiveDays, requiredNewCount } = calculateRequiredNewCount(
    newQuestions.length,
    setup,
    now,
  );
  const weakMap = new Map(
    analyzeWeakQuestions(activeQuestions, validHistory)
      .filter((w) => w.weaknessScore >= 0.35)
      .map((w) => [w.question.id, w.weaknessScore]),
  );
  const maxWeight = maximumWeight(activeQuestions);
  const urgency = clamp(1 - effectiveDays / 90);
  const candidates = new Map<string, Candidate>();
  const statesByQuestion = new Map(
    questionStates.map((state) => [state.questionId, state]),
  );
  const add = (q: Question, source: SourceType, weakness = 0, due = 0) => {
    const current = candidates.get(q.id) ?? {
      question: q,
      sourceTypes: new Set<SourceType>(),
      weaknessScore: 0,
      dueScore: 0,
      newScore: 0,
      priorityScore: 0,
      lastAnsweredAt: byQuestion.get(q.id)?.[0]?.answeredAt ?? "",
    };
    current.sourceTypes.add(source);
    current.weaknessScore = Math.max(current.weaknessScore, weakness);
    current.dueScore = Math.max(current.dueScore, due);
    current.newScore = source === "NEW" ? 1 : current.newScore;
    candidates.set(q.id, current);
  };
  activeQuestions.forEach((q) => {
    const answers = byQuestion.get(q.id);
    if (!answers) return;
    const state = statesByQuestion.get(q.id);
    const dueAt = state?.nextReviewAt ? timestamp(state.nextReviewAt) : NaN;
    if (
      Number.isFinite(dueAt) &&
      dueAt <= now.getTime()
    ) {
      const overdue = Math.max(
        0,
        Math.floor((now.getTime() - dueAt) / 86400000),
      );
      add(q, "REVIEW", 0, clamp((overdue + 1) / 14));
    }
    const weakness = weakMap.get(q.id);
    if (weakness !== undefined) add(q, "WEAK", weakness, 0);
  });
  newQuestions
    .sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id))
    .slice(0, requiredNewCount)
    .forEach((q) => add(q, "NEW"));
  candidates.forEach((c) => {
    const weight = c.question.weight / maxWeight;
    c.priorityScore = clamp(
      c.dueScore * 0.35 +
        c.weaknessScore * 0.3 +
        weight * 0.15 +
        urgency * 0.1 +
        c.newScore * 0.1,
    );
  });
  const sourceRank = (c: Candidate) =>
    c.sourceTypes.has("REVIEW") ? 0 : c.sourceTypes.has("WEAK") ? 1 : 2;
  const ordered = [...candidates.values()]
    .sort(
      (a, b) =>
        b.priorityScore - a.priorityScore ||
        sourceRank(a) - sourceRank(b) ||
        a.lastAnsweredAt.localeCompare(b.lastAnsweredAt) ||
        a.question.id.localeCompare(b.question.id),
    )
    .slice(0, setup.dailyQuestionLimit);
  const items: StudySessionItem[] = ordered.map((c, index) => ({
    order: index + 1,
    question: c.question,
    primarySourceType: c.sourceTypes.has("REVIEW")
      ? "REVIEW"
      : c.sourceTypes.has("WEAK")
        ? "WEAK"
        : "NEW",
    sourceTypes: [...c.sourceTypes],
    priorityScore: c.priorityScore,
  }));
  return {
    id: crypto.randomUUID(),
    createdAt: now.toISOString(),
    items,
    newCount: items.filter((i) => i.primarySourceType === "NEW").length,
    reviewCount: items.filter((i) => i.primarySourceType === "REVIEW").length,
    weakCount: items.filter((i) => i.primarySourceType === "WEAK").length,
    otherCount: items.filter((i) => i.primarySourceType === "CUSTOM").length,
    totalCount: items.length,
    estimatedMinutes: items.length === 0 ? 0 : Math.ceil(items.length * 0.75),
    remainingNewQuestions: newQuestions.length,
    effectiveDays,
    requiredNewCount,
  };
};

