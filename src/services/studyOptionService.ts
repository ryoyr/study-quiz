import type { MasteryFilter, QuestionMode } from "../types/Setup";

export const MASTERY_FILTER_OPTIONS: ReadonlyArray<{
  value: MasteryFilter;
  label: string;
}> = [
  { value: "ALL", label: "すべての理解度" },
  { value: "UNLEARNED", label: "未学習" },
  { value: "LEARNING", label: "学習中" },
  { value: "MASTERED", label: "習得済み" },
];

export const QUESTION_MODE_OPTIONS: ReadonlyArray<{
  value: QuestionMode;
  label: string;
}> = [
  { value: "ADAPTIVE", label: "おすすめ（期限・弱点・新規）" },
  { value: "NEW", label: "未回答" },
  { value: "REVIEW", label: "復習期限" },
  { value: "WEAK", label: "苦手" },
  { value: "ALL", label: "条件一致すべて" },
];

const normalizeSelection = <T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T[] => {
  const allowedSet = new Set<string>(allowed);
  const source = Array.isArray(value) ? value : [value];
  const normalized = [
    ...new Set(
      source.filter(
        (item): item is T =>
          typeof item === "string" && allowedSet.has(item),
      ),
    ),
  ];
  if (normalized.length === 0) return [fallback];
  return normalized.includes("ALL" as T) ? (["ALL"] as T[]) : normalized;
};

export const normalizeMasteryFilters = (
  value: unknown,
  legacyValue?: unknown,
): MasteryFilter[] =>
  normalizeSelection(
    Array.isArray(value) && value.length > 0 ? value : legacyValue,
    MASTERY_FILTER_OPTIONS.map((item) => item.value),
    "ALL",
  );

export const normalizeQuestionModes = (
  value: unknown,
  legacyValue?: unknown,
): QuestionMode[] =>
  normalizeSelection(
    Array.isArray(value) && value.length > 0 ? value : legacyValue,
    QUESTION_MODE_OPTIONS.map((item) => item.value),
    "ADAPTIVE",
  );

export const toggleExclusiveSelection = <T extends string>(
  current: readonly T[],
  value: T,
  fallback: T,
): T[] => {
  if (value === "ALL") return [value];
  const withoutAll = current.filter((item) => item !== "ALL");
  const next = withoutAll.includes(value)
    ? withoutAll.filter((item) => item !== value)
    : [...withoutAll, value];
  return next.length > 0 ? next : [fallback];
};

const selectionLabel = <T extends string>(
  selected: readonly T[],
  options: ReadonlyArray<{ value: T; label: string }>,
): string => {
  const labels = options
    .filter((option) => selected.includes(option.value))
    .map((option) => option.label);
  if (labels.length === 0) return "未選択";
  if (labels.length <= 2) return labels.join("・");
  return `${labels.length}項目`;
};

export const masteryFiltersLabel = (selected: readonly MasteryFilter[]): string =>
  selectionLabel(selected, MASTERY_FILTER_OPTIONS);

export const questionModesLabel = (selected: readonly QuestionMode[]): string =>
  selectionLabel(selected, QUESTION_MODE_OPTIONS);

