import { LPIC101_EXAM_SCOPE_ID } from "../types/ExamScope";
import type { MasteryFilter, QuestionMode, Setup, ThemePreference } from "../types/Setup";
import { STORAGE_KEYS } from "./storageKeyRegistry.ts";
import { legacyCategoryFromCategories, normalizeStudyCategories } from "./studyRangeService.ts";
import { differenceInCalendarDays } from "./localDateService.ts";

const STORAGE_KEY = STORAGE_KEYS.setup;
const MASTERY_FILTERS: MasteryFilter[] = ["ALL", "UNLEARNED", "LEARNING", "MASTERED"];
const QUESTION_MODES: QuestionMode[] = ["ADAPTIVE", "NEW", "REVIEW", "WEAK", "ALL"];
const THEMES: ThemePreference[] = ["system", "light", "dark"];

export const normalizeSetup = (value: Partial<Setup>): Setup => {
  const defaultCategories = normalizeStudyCategories(value.defaultCategories, value.defaultCategory);
  return {
    name: value.name ?? "LPIC-1 101",
    examDate: value.examDate ?? "",
    dailyNewLimit: value.dailyNewLimit ?? 10,
    dailyQuestionLimit: value.dailyQuestionLimit ?? 20,
    bufferRate: value.bufferRate ?? 20,
    instantThresholdSeconds: value.instantThresholdSeconds ?? 30,
    dailyMinimumQuestions: value.dailyMinimumQuestions ?? 15,
    reservedDates: Array.isArray(value.reservedDates) ? value.reservedDates : [],
    reservedWeekdays: Array.isArray(value.reservedWeekdays) ? value.reservedWeekdays : [],
    examScopeId: value.examScopeId?.trim() || LPIC101_EXAM_SCOPE_ID,
    defaultCategory: legacyCategoryFromCategories(defaultCategories),
    defaultCategories,
    defaultMasteryFilter: MASTERY_FILTERS.includes(value.defaultMasteryFilter as MasteryFilter)
      ? (value.defaultMasteryFilter as MasteryFilter)
      : "ALL",
    defaultQuestionMode: QUESTION_MODES.includes(value.defaultQuestionMode as QuestionMode)
      ? (value.defaultQuestionMode as QuestionMode)
      : "ADAPTIVE",
    defaultQuestionIds: Array.isArray(value.defaultQuestionIds)
      ? [...new Set(value.defaultQuestionIds.filter((item): item is string => typeof item === "string" && Boolean(item.trim())))]
      : [],
    theme: THEMES.includes(value.theme as ThemePreference)
      ? (value.theme as ThemePreference)
      : "system",
    setupCompleted: value.setupCompleted ?? false,
    createdAt: value.createdAt ?? new Date().toISOString(),
    updatedAt: value.updatedAt ?? new Date().toISOString(),
  };
};

export const loadSetup = (): Setup | null => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (!value) return null;
    return normalizeSetup(JSON.parse(value) as Partial<Setup>);
  } catch {
    return null;
  }
};

export const saveSetup = (setup: Setup): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeSetup(setup)));
};

export const clearSetup = (): void => localStorage.removeItem(STORAGE_KEY);

export const getRemainingDays = (
  examDate: string,
  now = new Date(),
): number => differenceInCalendarDays(examDate, now);
