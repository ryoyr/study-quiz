import type { Setup } from "../types/Setup";
import { STORAGE_KEYS } from "./storageKeyRegistry.ts";

const STORAGE_KEY = STORAGE_KEYS.setup;

const normalizeSetup = (value: Partial<Setup>): Setup => ({
  name: value.name ?? "LinuC 101",
  examDate: value.examDate ?? "",
  dailyNewLimit: value.dailyNewLimit ?? 10,
  dailyQuestionLimit: value.dailyQuestionLimit ?? 20,
  bufferRate: value.bufferRate ?? 20,
  instantThresholdSeconds: value.instantThresholdSeconds ?? 30,
  dailyMinimumQuestions: value.dailyMinimumQuestions ?? 15,
  reservedDates: Array.isArray(value.reservedDates) ? value.reservedDates : [],
  setupCompleted: value.setupCompleted ?? false,
  createdAt: value.createdAt ?? new Date().toISOString(),
  updatedAt: value.updatedAt ?? new Date().toISOString(),
});

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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(setup));
};

export const clearSetup = (): void => localStorage.removeItem(STORAGE_KEY);

export const getRemainingDays = (examDate: string): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exam = new Date(`${examDate}T00:00:00`);
  return Math.ceil((exam.getTime() - today.getTime()) / 86400000);
};

