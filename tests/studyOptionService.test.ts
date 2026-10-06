import assert from "node:assert/strict";
import test from "node:test";
import {
  masteryFiltersLabel,
  normalizeMasteryFilters,
  normalizeQuestionModes,
  questionModesLabel,
  toggleExclusiveSelection,
} from "../src/services/studyOptionService.ts";

test("旧単一値を複数選択配列へ正規化する", () => {
  assert.deepEqual(normalizeMasteryFilters(undefined, "LEARNING"), ["LEARNING"]);
  assert.deepEqual(normalizeQuestionModes(undefined, "REVIEW"), ["REVIEW"]);
});

test("ALLを他の選択肢と混在させない", () => {
  assert.deepEqual(normalizeMasteryFilters(["ALL", "MASTERED"]), ["ALL"]);
  assert.deepEqual(normalizeQuestionModes(["ALL", "NEW"]), ["ALL"]);
  assert.deepEqual(
    toggleExclusiveSelection(["ALL"], "LEARNING", "ALL"),
    ["LEARNING"],
  );
  assert.deepEqual(
    toggleExclusiveSelection(["LEARNING"], "LEARNING", "ALL"),
    ["ALL"],
  );
});

test("複数選択の要約表示を生成する", () => {
  assert.equal(masteryFiltersLabel(["UNLEARNED", "LEARNING"]), "未学習・学習中");
  assert.equal(questionModesLabel(["NEW", "REVIEW", "WEAK"]), "3項目");
});
