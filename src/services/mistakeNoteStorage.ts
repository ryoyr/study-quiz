import type { MistakeNote } from "../types/MistakeNote";
import { STORAGE_KEYS } from "./storageKeyRegistry.ts";

const STORAGE_KEY = STORAGE_KEYS.mistakeNotes;

export const loadMistakeNotes = (): MistakeNote[] => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (!value) return [];
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is MistakeNote =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as MistakeNote).questionId === "string",
    );
  } catch {
    return [];
  }
};

export const saveMistakeNotes = (notes: MistakeNote[]): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
};

export const upsertMistakeNote = (
  notes: MistakeNote[],
  note: MistakeNote,
): MistakeNote[] => {
  const next = notes.filter((item) => item.questionId !== note.questionId);
  next.push(note);
  next.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return next;
};

