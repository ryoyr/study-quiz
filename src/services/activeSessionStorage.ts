import type { Question } from "../types/Question";
import { STORAGE_KEYS } from "./storageKeyRegistry.ts";
import { removeStorageValue, writeStorageValue } from "./verifiedStorage.ts";

const STORAGE_KEY = STORAGE_KEYS.activeSession;

export interface ActiveSessionSnapshot {
  questionIds: string[];
  currentIndex: number;
  correctCount: number;
  startedAt: string;
}

export interface ReconciledActiveSession {
  snapshot: ActiveSessionSnapshot;
  questions: Question[];
  changed: boolean;
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
    removeStorageValue(STORAGE_KEY);
    return null;
  } catch {
    try {
      removeStorageValue(STORAGE_KEY);
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
  writeStorageValue(STORAGE_KEY, JSON.stringify(snapshot));
  return snapshot;
};

export const clearActiveSession = (): void =>
  removeStorageValue(STORAGE_KEY);

export const resolveActiveSessionQuestions = (
  snapshot: ActiveSessionSnapshot,
  questions: Question[],
): Question[] => reconcileActiveSessionSnapshot(snapshot, questions)?.questions ?? [];

/**
 * セッション保存後に問題がアーカイブ・削除された場合でも、未回答の先頭を
 * 正しい再開位置に補正する。回答済み件数も現存する出題数の範囲へ収める。
 */
export const reconcileActiveSessionSnapshot = (
  snapshot: ActiveSessionSnapshot,
  questions: Question[],
): ReconciledActiveSession | null => {
  const byId = new Map(questions.map((question) => [question.id, question]));
  const answeredIds = snapshot.questionIds
    .slice(0, snapshot.currentIndex)
    .filter((id) => byId.has(id));
  const unansweredIds = snapshot.questionIds
    .slice(snapshot.currentIndex)
    .filter((id) => byId.has(id));
  if (unansweredIds.length === 0) return null;

  const questionIds = [...answeredIds, ...unansweredIds];
  const currentIndex = answeredIds.length;
  const reconciled: ActiveSessionSnapshot = {
    ...snapshot,
    questionIds,
    currentIndex,
    correctCount: Math.min(snapshot.correctCount, currentIndex),
  };
  const changed =
    currentIndex !== snapshot.currentIndex ||
    reconciled.correctCount !== snapshot.correctCount ||
    questionIds.length !== snapshot.questionIds.length;
  return {
    snapshot: reconciled,
    questions: questionIds.map((id) => byId.get(id) as Question),
    changed,
  };
};
