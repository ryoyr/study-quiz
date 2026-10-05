const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

type LocalDateParts = {
  year: number;
  month: number;
  day: number;
};

const parseParts = (value: string): LocalDateParts | null => {
  const match = LOCAL_DATE_PATTERN.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(0);
  parsed.setHours(0, 0, 0, 0);
  parsed.setFullYear(year, month - 1, day);
  return parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
    ? { year, month, day }
    : null;
};

const ordinalFromParts = ({ year, month, day }: LocalDateParts): number => {
  const utc = new Date(0);
  utc.setUTCHours(0, 0, 0, 0);
  utc.setUTCFullYear(year, month - 1, day);
  return Math.trunc(utc.getTime() / DAY_MS);
};

export const formatLocalDate = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const parseLocalDate = (value: string): Date | null => {
  const parts = parseParts(value);
  if (!parts) return null;
  const date = new Date(0);
  date.setHours(0, 0, 0, 0);
  date.setFullYear(parts.year, parts.month - 1, parts.day);
  return date;
};

export const isValidLocalDate = (value: string): boolean =>
  parseParts(value) !== null;

/**
 * ローカル暦日同士の日数差を返す。
 * ミリ秒差ではなくUTC上の暦日番号を使い、夏時間の23/25時間日でもずれない。
 */
export const differenceInCalendarDays = (
  targetDate: string,
  baseDate: Date,
): number => {
  const target = parseParts(targetDate);
  if (!target || Number.isNaN(baseDate.getTime())) return Number.NaN;
  const base: LocalDateParts = {
    year: baseDate.getFullYear(),
    month: baseDate.getMonth() + 1,
    day: baseDate.getDate(),
  };
  return ordinalFromParts(target) - ordinalFromParts(base);
};