import type { Setup } from "../types/Setup";

const STORAGE_KEY = "study-quiz-setup-v1";

export const loadSetup = (): Setup | null => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);

    if (!value) {
      return null;
    }

    return JSON.parse(value) as Setup;
  } catch {
    return null;
  }
};

export const saveSetup = (
  setup: Setup,
): void => {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(setup),
  );
};

export const clearSetup = (): void => {
  localStorage.removeItem(STORAGE_KEY);
};

export const getRemainingDays = (
  examDate: string,
): number => {
  const today = new Date();

  today.setHours(0, 0, 0, 0);

  const exam = new Date(examDate);

  exam.setHours(0, 0, 0, 0);

  return Math.ceil(
    (exam.getTime() - today.getTime()) /
      (1000 * 60 * 60 * 24),
  );
};
