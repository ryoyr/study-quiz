import type { Setup } from "../types/Setup";

export const validateSetup = (
  setup: Setup,
): string => {
  if (
    !setup.name.trim()
  ) {
    return "試験名を入力してください";
  }

  if (
    !setup.examDate
  ) {
    return "試験日を入力してください";
  }

  if (
    setup.dailyQuestionLimit <
    setup.dailyNewLimit
  ) {
    return "総問題上限は新規上限以上にしてください";
  }

  return "";
};