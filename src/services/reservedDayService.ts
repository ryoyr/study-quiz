import type { Setup } from "../types/Setup";

export const toLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const parseLocalDate = (value: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
    ? date
    : null;
};

export const normalizeReservedWeekdays = (values: number[] = []): number[] =>
  [...new Set(values)]
    .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6)
    .sort((left, right) => left - right);

export const normalizeReservedDates = (values: string[] = []): string[] =>
  [...new Set(values.filter((value) => parseLocalDate(value) !== null))].sort();

const createdDate = (setup: Setup, fallback: Date): Date => {
  const value = setup.createdAt?.slice(0, 10);
  return parseLocalDate(value) ?? fallback;
};

/** 個別指定日と曜日指定を、学習計画・ストリーク計算で使う実日付へ展開する。 */
export const getEffectiveReservedDates = (
  setup: Setup,
  now = new Date(),
): string[] => {
  const dates = new Set(normalizeReservedDates(setup.reservedDates));
  const weekdays = new Set(normalizeReservedWeekdays(setup.reservedWeekdays));
  const examDate = parseLocalDate(setup.examDate);
  if (!examDate || weekdays.size === 0) return [...dates].sort();

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = createdDate(setup, today);
  const cursor = start > examDate ? today : start;
  const maximumDays = 3660;
  for (let index = 0; index < maximumDays && cursor < examDate; index += 1) {
    if (weekdays.has(cursor.getDay())) dates.add(toLocalDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return [...dates].sort();
};
