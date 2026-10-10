import { LPIC101_EXAM_SCOPE_ID } from "../types/ExamScope";
import type { Setup, ThemePreference, VisualTheme } from "../types/Setup";
import { STORAGE_KEYS } from "./storageKeyRegistry.ts";
import {
  legacyCategoryFromCategories,
  normalizeStudyCategories,
} from "./studyRangeService.ts";
import {
  normalizeMasteryFilters,
  normalizeQuestionModes,
} from "./studyOptionService.ts";
import { differenceInCalendarDays } from "./localDateService.ts";
import { removeStorageValue, writeStorageValue } from "./verifiedStorage.ts";

const STORAGE_KEY = STORAGE_KEYS.setup;
const THEMES: ThemePreference[] = ["system", "light", "dark"];
const VISUAL_THEMES: VisualTheme[] = ["aurora", "focus", "forest", "sunset", "mono"];

export const normalizeSetup = (value: Partial<Setup>): Setup => {
  const defaultCategories = normalizeStudyCategories(
    value.defaultCategories,
    value.defaultCategory,
  );
  const defaultMasteryFilters = normalizeMasteryFilters(
    value.defaultMasteryFilters,
    value.defaultMasteryFilter,
  );
  const defaultQuestionModes = normalizeQuestionModes(
    value.defaultQuestionModes,
    value.defaultQuestionMode,
  );
  return {
    name: value.name ?? "LPIC-1 101",
    examDate: value.examDate ?? "",
    dailyNewLimit: value.dailyNewLimit ?? 10,
    dailyQuestionLimit: value.dailyQuestionLimit ?? 20,
    bufferRate: value.bufferRate ?? 20,
    instantThresholdSeconds: value.instantThresholdSeconds ?? 30,
    dailyMinimumQuestions: value.dailyMinimumQuestions ?? 15,
    reservedDates: Array.isArray(value.reservedDates) ? value.reservedDates : [],
    reservedWeekdays: Array.isArray(value.reservedWeekdays)
      ? value.reservedWeekdays
      : [],
    examScopeId: value.examScopeId?.trim() || LPIC101_EXAM_SCOPE_ID,
    defaultCategory: legacyCategoryFromCategories(defaultCategories),
    defaultCategories,
    defaultMasteryFilter:
      defaultMasteryFilters.length === 1 ? defaultMasteryFilters[0] : "ALL",
    defaultMasteryFilters,
    defaultQuestionMode:
      defaultQuestionModes.length === 1 ? defaultQuestionModes[0] : "ADAPTIVE",
    defaultQuestionModes,
    defaultQuestionIds: Array.isArray(value.defaultQuestionIds)
      ? [
          ...new Set(
            value.defaultQuestionIds.filter(
              (item): item is string =>
                typeof item === "string" && Boolean(item.trim()),
            ),
          ),
        ]
      : [],
    theme: THEMES.includes(value.theme as ThemePreference)
      ? (value.theme as ThemePreference)
      : "system",
    visualTheme: VISUAL_THEMES.includes(value.visualTheme as VisualTheme)
      ? (value.visualTheme as VisualTheme)
      : "aurora",
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
  writeStorageValue(STORAGE_KEY, JSON.stringify(normalizeSetup(setup)));
};

export const clearSetup = (): void => removeStorageValue(STORAGE_KEY);

export const getRemainingDays = (
  examDate: string,
  now = new Date(),
): number => differenceInCalendarDays(examDate, now);
