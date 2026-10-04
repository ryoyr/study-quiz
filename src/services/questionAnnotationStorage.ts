import type { QuestionAnnotation } from '../types/QuestionAnnotation';
const STORAGE_KEY = 'study-quiz-question-annotations-v1';
export const loadQuestionAnnotations = (): QuestionAnnotation[] => {
  try { const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as unknown; return Array.isArray(parsed) ? parsed.filter((item): item is QuestionAnnotation => typeof item === 'object' && item !== null && typeof (item as QuestionAnnotation).questionId === 'string') : []; } catch { return []; }
};
export const saveQuestionAnnotations = (items: QuestionAnnotation[]): void => localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
export const updateQuestionAnnotation = (items: QuestionAnnotation[], questionId: string, update: Partial<Pick<QuestionAnnotation, 'favorite' | 'memo'>>): QuestionAnnotation[] => {
  const previous = items.find((item) => item.questionId === questionId);
  const next: QuestionAnnotation = { questionId, favorite: update.favorite ?? previous?.favorite ?? false, memo: update.memo ?? previous?.memo ?? '', updatedAt: new Date().toISOString() };
  const result = [...items.filter((item) => item.questionId !== questionId), next];
  saveQuestionAnnotations(result);
  return result;
};
