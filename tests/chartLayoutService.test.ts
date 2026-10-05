import assert from "node:assert/strict";
import test from "node:test";
import { selectChartTickIndexes } from "../src/services/chartLayoutService.ts";

test("14日グラフの目盛りは両端を含めて均等に配置する", () => {
  const indexes = selectChartTickIndexes(14);
  assert.deepEqual(indexes, [0, 3, 7, 10, 13]);
  assert.equal(indexes.at(-1), 13);
  assert.equal(indexes.at(-1)! - indexes.at(-2)!, 3);
});

test("データが少ない場合は重複しない全目盛りを返す", () => {
  assert.deepEqual(selectChartTickIndexes(0), []);
  assert.deepEqual(selectChartTickIndexes(1), [0]);
  assert.deepEqual(selectChartTickIndexes(3), [0, 1, 2]);
});