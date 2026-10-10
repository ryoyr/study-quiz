import type { StudyHistory } from "../types/StudyHistory";

export interface StudyStreak {
  currentDays: number;
  longestDays: number;
  studiedToday: boolean;
  reservedToday: boolean;
  totalStudyDays: number;
  skippedReservedDays: number;
  lastStudyDate: string | null;
}

const DAY_MS = 86_400_000;
const localDayNumber = (value: string | Date): number | null => {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS,
  );
};
const dayNumberToDate = (day: number): string => {
  const date = new Date(day * DAY_MS);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
};

export const calculateStudyStreak = (
  history: StudyHistory[],
  reservedDates: string[] = [],
  now = new Date(),
): StudyStreak => {
  const today = localDayNumber(now);
  if (today === null) {
    return {
      currentDays: 0,
      longestDays: 0,
      studiedToday: false,
      reservedToday: false,
      totalStudyDays: 0,
      skippedReservedDays: 0,
      lastStudyDate: null,
    };
  }
  const studyDays = new Set(
    history
      .map((item) => localDayNumber(item.answeredAt))
      .filter((day): day is number => day !== null && day <= today),
  );
  const reservedDays = new Set(
    reservedDates
      .map((date) => localDayNumber(`${date}T00:00:00`))
      .filter((day): day is number => day !== null),
  );
  const sortedStudyDays = [...studyDays].sort((a, b) => a - b);
  const studiedToday = studyDays.has(today);
  const reservedToday = reservedDays.has(today);
  if (sortedStudyDays.length === 0) {
    return {
      currentDays: 0,
      longestDays: 0,
      studiedToday,
      reservedToday,
      totalStudyDays: 0,
      skippedReservedDays: 0,
      lastStudyDate: null,
    };
  }

  let currentDays = 0;
  let skippedReservedDays = 0;
  let cursor = today;
  if (!studiedToday && !reservedToday) cursor -= 1;
  while (cursor >= sortedStudyDays[0]) {
    if (studyDays.has(cursor)) {
      currentDays += 1;
      cursor -= 1;
      continue;
    }
    if (reservedDays.has(cursor)) {
      skippedReservedDays += 1;
      cursor -= 1;
      continue;
    }
    break;
  }

  let longestDays = 0;
  let running = 0;
  let previousStudyDay: number | null = null;
  for (const studyDay of sortedStudyDays) {
    if (previousStudyDay === null) {
      running = 1;
    } else {
      let connected = true;
      for (let day = previousStudyDay + 1; day < studyDay; day += 1) {
        if (!reservedDays.has(day)) {
          connected = false;
          break;
        }
      }
      running = connected ? running + 1 : 1;
    }
    longestDays = Math.max(longestDays, running);
    previousStudyDay = studyDay;
  }

  return {
    currentDays,
    longestDays,
    studiedToday,
    reservedToday,
    totalStudyDays: sortedStudyDays.length,
    skippedReservedDays,
    lastStudyDate: dayNumberToDate(sortedStudyDays[sortedStudyDays.length - 1]),
  };
};
