import { questions as seedQuestions } from "../data/questions.ts";
import { LPIC101_EXAM_SCOPE_ID } from "../types/ExamScope";
import type { Question } from "../types/Question";
import { STORAGE_KEYS } from "./storageKeyRegistry.ts";

const STORAGE_KEY = STORAGE_KEYS.questions;
const SEED_VERSION_KEY = STORAGE_KEYS.questionSeedVersion;
const CURRENT_SEED_VERSION = "3";

const normalizeQuestion = (value: Partial<Question>): Partial<Question> => ({
  ...value,
  examScopeId:
    typeof value.examScopeId === "string" && value.examScopeId.trim()
      ? value.examScopeId
      : LPIC101_EXAM_SCOPE_ID,
});

const isQuestion = (value: unknown): value is Question => {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<Question>;
  return (
    typeof item.id === "string" &&
    item.id.trim().length > 0 &&
    typeof item.examScopeId === "string" &&
    item.examScopeId.trim().length > 0 &&
    typeof item.category === "string" &&
    item.category.trim().length > 0 &&
    typeof item.text === "string" &&
    item.text.trim().length > 0 &&
    Array.isArray(item.choices) &&
    item.choices.length >= 2 &&
    item.choices.length <= 8 &&
    item.choices.every(
      (choice) => typeof choice === "string" && choice.trim().length > 0,
    ) &&
    Number.isInteger(item.answerIndex) &&
    Number(item.answerIndex) >= 0 &&
    Number(item.answerIndex) < item.choices.length &&
    typeof item.explanation === "string" &&
    typeof item.weight === "number" &&
    Number.isFinite(item.weight) &&
    item.weight > 0 &&
    Number.isInteger(item.difficulty) &&
    Number(item.difficulty) >= 1 &&
    Number(item.difficulty) <= 5 &&
    (item.archivedAt === undefined ||
      (typeof item.archivedAt === "string" &&
        Number.isFinite(Date.parse(item.archivedAt))))
  );
};

export const loadQuestions = (): Question[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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

    if (localStorage.getItem(SEED_VERSION_KEY) !== CURRENT_SEED_VERSION) {
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  localStorage.setItem(SEED_VERSION_KEY, CURRENT_SEED_VERSION);
};
