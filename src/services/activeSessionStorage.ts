import type { Question } from '../types/Question';

const STORAGE_KEY = 'study-quiz-active-session-v1';

export interface ActiveSessionSnapshot {
  questionIds: string[];
  currentIndex: number;
  correctCount: number;
  startedAt: string;
}

const isSnapshot = (value: unknown): value is ActiveSessionSnapshot => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<ActiveSessionSnapshot>;
  return Array.isArray(item.questionIds)
    && item.questionIds.length > 0
    && item.questionIds.every((id) => typeof id === 'string')
    && Number.isInteger(item.currentIndex)
    && (item.currentIndex ?? -1) >= 0
    && Number.isInteger(item.correctCount)
    && (item.correctCount ?? -1) >= 0
    && typeof item.startedAt === 'string';
};

export const loadActiveSession = (): ActiveSessionSnapshot | null => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    return isSnapshot(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const saveActiveSession = (snapshot: ActiveSessionSnapshot): ActiveSessionSnapshot => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  return snapshot;
};

export const clearActiveSession = (): void => localStorage.removeItem(STORAGE_KEY);

export const resolveActiveSessionQuestions = (
  snapshot: ActiveSessionSnapshot,
  questions: Question[],
): Question[] => {
  const byId = new Map(questions.map((question) => [question.id, question]));
  return snapshot.questionIds.map((id) => byId.get(id)).filter((item): item is Question => Boolean(item));
};
