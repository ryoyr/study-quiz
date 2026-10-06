import type {
  CorrectionSuggestion,
  CorrectionSuggestionStatus,
} from "../types/CorrectionSuggestion";
import { STORAGE_KEYS } from "./storageKeyRegistry.ts";

const STORAGE_KEY = STORAGE_KEYS.correctionSuggestions;
export const loadCorrectionSuggestions = (): CorrectionSuggestion[] => {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? "[]",
    ) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter(
          (item): item is CorrectionSuggestion =>
            typeof item === "object" &&
            item !== null &&
            typeof (item as CorrectionSuggestion).id === "string" &&
            typeof (item as CorrectionSuggestion).questionId === "string",
        )
      : [];
  } catch {
    return [];
  }
};
export const saveCorrectionSuggestions = (
  items: CorrectionSuggestion[],
): void => localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
export const addCorrectionSuggestion = (
  items: CorrectionSuggestion[],
  input: Pick<
    CorrectionSuggestion,
    "questionId" | "suggestion" | "reason" | "reference"
  >,
): CorrectionSuggestion[] => {
  const now = new Date().toISOString();
  const next: CorrectionSuggestion = {
    id: crypto.randomUUID(),
    ...input,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };
  const result = [next, ...items];
  return result;
};
export const changeCorrectionSuggestionStatus = (
  items: CorrectionSuggestion[],
  id: string,
  status: CorrectionSuggestionStatus,
): CorrectionSuggestion[] => {
  const result = items.map((item) =>
    item.id === id
      ? { ...item, status, updatedAt: new Date().toISOString() }
      : item,
  );
  return result;
};
export const deleteCorrectionSuggestion = (
  items: CorrectionSuggestion[],
  id: string,
): CorrectionSuggestion[] => {
  const result = items.filter((item) => item.id !== id);
  return result;
};

