import { questions as seedQuestions } from "../data/questions.ts";
import { LPIC101_EXAM_SCOPE_ID } from "../types/ExamScope";
import type { Question } from "../types/Question";
import { isQuestion } from "./questionValidation.ts";
import { STORAGE_KEYS } from "./storageKeyRegistry.ts";
import { executeStorageTransaction } from "./storageTransaction.ts";

export const QUESTIONS_STORAGE_KEY = STORAGE_KEYS.questions;
export const QUESTION_SEED_VERSION_KEY = STORAGE_KEYS.questionSeedVersion;
export const QUESTION_SEED_VERSION = "4";

const normalizeQuestion = (value: Partial<Question>): Partial<Question> => ({
  ...value,
  examScopeId:
    typeof value.examScopeId === "string" && value.examScopeId.trim()
      ? value.examScopeId
      : LPIC101_EXAM_SCOPE_ID,
});

export const loadQuestions = (): Question[] => {
  try {
    const raw = localStorage.getItem(QUESTIONS_STORAGE_KEY);
    if (!raw) {
      saveQuestions(seedQuestions);
      return [...seedQuestions];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...seedQuestions];
    if (parsed.length === 0) return [];
    const valid = parsed
      .map((item) => normalizeQuestion(item as Partial<Question>))
      .filter(isQuestion);
    const unique = [...new Map(valid.map((item) => [item.id, item])).values()];
    if (unique.length === 0) return [...seedQuestions];

    if (localStorage.getItem(QUESTION_SEED_VERSION_KEY) !== QUESTION_SEED_VERSION) {
      const ids = new Set(unique.map((item) => item.id));
      const upgraded = [
        ...unique,
        ...seedQuestions.filter((item) => !ids.has(item.id)),
      ];
      saveQuestions(upgraded);
      return upgraded;
    }
    return unique;
  } catch {
    return [...seedQuestions];
  }
};

export const saveQuestions = (items: Question[]): void => {
  if (items.length > 100_000 || !items.every(isQuestion)) {
    throw new Error("保存する問題データの形式が不正です。");
  }
  if (new Set(items.map((item) => item.id)).size !== items.length) {
    throw new Error("問題IDが重複しているため保存できません。");
  }
  executeStorageTransaction([
    { key: QUESTIONS_STORAGE_KEY, value: JSON.stringify(items) },
    { key: QUESTION_SEED_VERSION_KEY, value: QUESTION_SEED_VERSION },
  ]);
};

