import type { MasteryFilter, QuestionMode, Setup } from "../types/Setup";
import { formatLocalDate, isValidLocalDate } from "./localDateService.ts";

export type SetupErrors = Partial<
  Record<
    | "name"
    | "examDate"
    | "dailyNewLimit"
    | "dailyQuestionLimit"
    | "bufferRate"
    | "instantThresholdSeconds"
    | "dailyMinimumQuestions"
    | "reservedDates"
    | "examScopeId"
    | "defaultCategory"
    | "defaultCategories"
    | "defaultMasteryFilter"
    | "defaultMasteryFilters"
    | "defaultQuestionMode"
    | "defaultQuestionModes"
    | "defaultQuestionIds"
    | "theme",
    string
  >
>;

const validExclusiveSelection = <T extends string>(
  values: unknown,
  allowed: readonly T[],
): values is T[] =>
  Array.isArray(values) &&
  values.length > 0 &&
  values.every(
    (value): value is T =>
      typeof value === "string" && allowed.includes(value as T),
  ) &&
  new Set(values).size === values.length &&
  (!values.includes("ALL" as T) || values.length === 1);

export const validateSetup = (setup: Setup, now = new Date()): SetupErrors => {
  const errors: SetupErrors = {};
  const today = formatLocalDate(now);
  if (!setup.name.trim()) errors.name = "試験名は必須です。";
  else if (setup.name.trim().length > 120)
    errors.name = "試験名は120文字以内です。";
  if (!isValidLocalDate(setup.examDate))
    errors.examDate = "正しい試験日を入力してください。";
  else if (setup.examDate < today)
    errors.examDate = "試験日は本日以降です。";
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
      (date) =>
        !isValidLocalDate(date) || date < today || date >= setup.examDate,
    )
  )
    errors.reservedDates = "学習しない日は本日から試験日前日までです。";
  const weekdays = setup.reservedWeekdays ?? [];
  if (
    !Array.isArray(weekdays) ||
    new Set(weekdays).size !== weekdays.length ||
    weekdays.some(
      (weekday) =>
        !Number.isInteger(weekday) || weekday < 0 || weekday > 6,
    )
  )
    errors.reservedDates = "学習しない曜日の指定が不正です。";

  if (!setup.examScopeId?.trim())
    errors.examScopeId = "試験枠を選択してください。";
  if (!setup.defaultCategory?.trim())
    errors.defaultCategory = "学習範囲を選択してください。";
  if (
    !Array.isArray(setup.defaultCategories) ||
    setup.defaultCategories.length === 0 ||
    setup.defaultCategories.some(
      (category) => typeof category !== "string" || !category.trim(),
    ) ||
    new Set(setup.defaultCategories).size !== setup.defaultCategories.length ||
    (setup.defaultCategories.includes("ALL") &&
      setup.defaultCategories.length !== 1)
  )
    errors.defaultCategories = "学習範囲の初期値が不正です。";

  const masteryValues: MasteryFilter[] = [
    "ALL",
    "UNLEARNED",
    "LEARNING",
    "MASTERED",
  ];
  if (!masteryValues.includes(setup.defaultMasteryFilter))
    errors.defaultMasteryFilter = "理解度の互換値が不正です。";
  if (!validExclusiveSelection(setup.defaultMasteryFilters, masteryValues))
    errors.defaultMasteryFilters = "理解度の初期値が不正です。";

  const modeValues: QuestionMode[] = [
    "ADAPTIVE",
    "NEW",
    "REVIEW",
    "WEAK",
    "ALL",
  ];
  if (!modeValues.includes(setup.defaultQuestionMode))
    errors.defaultQuestionMode = "出題方法の互換値が不正です。";
  if (!validExclusiveSelection(setup.defaultQuestionModes, modeValues))
    errors.defaultQuestionModes = "出題方法の初期値が不正です。";

  if (
    !Array.isArray(setup.defaultQuestionIds) ||
    setup.defaultQuestionIds.some(
      (id) => typeof id !== "string" || !id.trim(),
    ) ||
    new Set(setup.defaultQuestionIds).size !== setup.defaultQuestionIds.length
  )
    errors.defaultQuestionIds = "個別問題の初期値が不正です。";
  if (!["system", "light", "dark"].includes(setup.theme))
    errors.theme = "テーマの指定が不正です。";
  return errors;
};
