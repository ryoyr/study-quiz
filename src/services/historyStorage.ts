import type { StudyHistory } from "../types/StudyHistory";
import { STORAGE_KEYS } from "./storageKeyRegistry.ts";

const STORAGE_KEY = STORAGE_KEYS.answerHistory;
const FSRS_RATINGS = new Set<NonNullable<StudyHistory["fsrsRating"]>>([
  "AGAIN",
  "HARD",
  "GOOD",
  "EASY",
]);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalize = (value: Record<string, unknown>): StudyHistory | null => {
  if (
    typeof value.id !== "string" ||
    !value.id ||
    typeof value.questionId !== "string" ||
    !value.questionId ||
    typeof value.category !== "string" ||
    !Number.isInteger(value.selectedIndex) ||
    Number(value.selectedIndex) < 0 ||
    typeof value.correct !== "boolean" ||
    typeof value.answeredAt !== "string" ||
    !Number.isFinite(Date.parse(value.answeredAt))
  )
    return null;

  const responseTimeSeconds =
    typeof value.responseTimeSeconds === "number" &&
    Number.isFinite(value.responseTimeSeconds)
      ? Math.max(0, value.responseTimeSeconds)
      : 0;
  const instantScore =
    typeof value.instantScore === "number" &&
    Number.isFinite(value.instantScore)
      ? Math.min(1, Math.max(0, value.instantScore))
      : 0;
  const fsrsRating = FSRS_RATINGS.has(
    value.fsrsRating as NonNullable<StudyHistory["fsrsRating"]>,
  )
    ? (value.fsrsRating as NonNullable<StudyHistory["fsrsRating"]>)
    : undefined;

  return {
    id: value.id,
    questionId: value.questionId,
    category: value.category,
    selectedIndex: Number(value.selectedIndex),
    correct: value.correct,
    answeredAt: value.answeredAt,
    responseTimeSeconds,
    instantScore,
    ...(fsrsRating ? { fsrsRating } : {}),
  };
};

export const loadHistory = (): StudyHistory[] => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (!value) return [];
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => (isObject(item) ? normalize(item) : null))
      .filter((item): item is StudyHistory => item !== null);
  } catch {
    return [];
  }
};

export const saveHistory = (history: StudyHistory[]): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
};

export const clearHistory = (): void => localStorage.removeItem(STORAGE_KEY);

