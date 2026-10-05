export const normalizeStudyCategories = (
  categories: unknown,
  legacyCategory = "ALL",
): string[] => {
  const source = Array.isArray(categories) ? categories : [legacyCategory];
  const normalized = [
    ...new Set(
      source
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
  if (normalized.length === 0 || normalized.includes("ALL")) return ["ALL"];
  return normalized;
};

export const legacyCategoryFromCategories = (categories: string[]): string => {
  const normalized = normalizeStudyCategories(categories);
  return normalized.length === 1 ? normalized[0] : "ALL";
};

export const studyRangeLabel = (categories: string[]): string => {
  const normalized = normalizeStudyCategories(categories);
  if (normalized.includes("ALL")) return "全トピック";
  if (normalized.length <= 2) return normalized.join("、");
  return `${normalized.length}トピック`;
};