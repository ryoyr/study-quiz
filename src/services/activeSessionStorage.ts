import type { Question } from "../types/Question";
import { STORAGE_KEYS } from "./storageKeyRegistry.ts";

const STORAGE_KEY = STORAGE_KEYS.activeSession;

export interface ActiveSessionSnapshot {
  questionIds: string[];
  currentIndex: number;
  correctCount: number;
  startedAt: string;
}

export const isActiveSessionSnapshot = (
  value: unknown,
): value is ActiveSessionSnapshot => {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<ActiveSessionSnapshot>;
  if (
    !Array.isArray(item.questionIds) ||
    item.questionIds.length === 0 ||
    !item.questionIds.every(
      (id) => typeof id === "string" && id.trim().length > 0,
    ) ||
    new Set(item.questionIds).size !== item.questionIds.length ||
    !Number.isInteger(item.currentIndex) ||
    !Number.isInteger(item.correctCount) ||
    typeof item.startedAt !== "string" ||
    !Number.isFinite(Date.parse(item.startedAt))
  )
    return false;

  const currentIndex = item.currentIndex ?? -1;
  const correctCount = item.correctCount ?? -1;
  return (
    currentIndex >= 0 &&
    currentIndex < item.questionIds.length &&
    correctCount >= 0 &&
    correctCount <= currentIndex
  );
};

export const loadActiveSession = (): ActiveSessionSnapshot | null => {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? "null",
    );
    if (isActiveSessionSnapshot(parsed)) return parsed;
    localStorage.removeItem(STORAGE_KEY);
    return null;
  } catch {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* 読み書き不可の環境ではメモリ上だけで継続する。 */
    }
    return null;
  }
};

export const saveActiveSession = (
  snapshot: ActiveSessionSnapshot,
): ActiveSessionSnapshot => {
  if (!isActiveSessionSnapshot(snapshot))
    throw new Error("中断セッションの状態が不正です。");
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  return snapshot;
};

export const clearActiveSession = (): void =>
  localStorage.removeItem(STORAGE_KEY);

export const resolveActiveSessionQuestions = (
  snapshot: ActiveSessionSnapshot,
  questions: Question[],
): Question[] => {
  const byId = new Map(questions.map((question) => [question.id, question]));
  return snapshot.questionIds
    .map((id) => byId.get(id))
    .filter((item): item is Question => Boolean(item));
};
