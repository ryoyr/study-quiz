import type { Setup } from "../types/Setup";

export type SetupErrors = Partial<
  Record<
    | "name"
    | "examDate"
    | "dailyNewLimit"
    | "dailyQuestionLimit"
    | "bufferRate"
    | "instantThresholdSeconds"
    | "dailyMinimumQuestions"
    | "reservedDates",
    string
  >
>;

const localDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const isValidDate = (value: string): boolean => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  );
};

export const validateSetup = (setup: Setup, now = new Date()): SetupErrors => {
  const errors: SetupErrors = {};
  const today = localDate(now);
  if (!setup.name.trim()) errors.name = "試験名は必須です。";
  else if (setup.name.trim().length > 120)
    errors.name = "試験名は120文字以内です。";
  if (!isValidDate(setup.examDate))
    errors.examDate = "正しい試験日を入力してください。";
  else if (setup.examDate < today) errors.examDate = "試験日は本日以降です。";
  if (
    !Number.isInteger(setup.dailyNewLimit) ||
    setup.dailyNewLimit < 1 ||
    setup.dailyNewLimit > 500
  )
    errors.dailyNewLimit = "1～500の整数で指定してください。";
  if (
    !Number.isInteger(setup.dailyQuestionLimit) ||
    setup.dailyQuestionLimit < setup.dailyNewLimit ||
    setup.dailyQuestionLimit > 1000
  )
    errors.dailyQuestionLimit =
      "新規問題上限以上、1000以下の整数で指定してください。";
  if (
    !Number.isFinite(setup.bufferRate) ||
    setup.bufferRate < 0 ||
    setup.bufferRate > 100
  )
    errors.bufferRate = "0～100%で指定してください。";
  if (
    !Number.isInteger(setup.instantThresholdSeconds) ||
    setup.instantThresholdSeconds < 1 ||
    setup.instantThresholdSeconds > 3600
  )
    errors.instantThresholdSeconds = "1～3600秒の整数で指定してください。";
  if (
    !Number.isInteger(setup.dailyMinimumQuestions) ||
    setup.dailyMinimumQuestions < 1 ||
    setup.dailyMinimumQuestions > setup.dailyQuestionLimit
  )
    errors.dailyMinimumQuestions =
      "1以上、1日の総問題数上限以下で指定してください。";
  const dates = setup.reservedDates ?? [];
  if (dates.length > 3660)
    errors.reservedDates = "学習しない日は3660件以内です。";
  else if (new Set(dates).size !== dates.length)
    errors.reservedDates = "学習しない日が重複しています。";
  else if (
    dates.some(
      (date) => !isValidDate(date) || date < today || date >= setup.examDate,
    )
  )
    errors.reservedDates = "学習しない日は本日から試験日前日までです。";
  return errors;
};
