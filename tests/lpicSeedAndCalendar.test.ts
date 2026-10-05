import assert from "node:assert/strict";
import test from "node:test";
import { questions } from "../src/data/questions.ts";
import { getEffectiveReservedDates } from "../src/services/reservedDayService.ts";
import type { Setup } from "../src/types/Setup.ts";

test("LPIC-1 101のオリジナル初期問題を50問収録する", () => {
  assert.equal(questions.length, 50);
  assert.equal(new Set(questions.map((item) => item.id)).size, 50);
  assert.equal(questions.every((item) => item.id.startsWith("LPIC101-")), true);
  assert.equal(questions.every((item) => item.choices.length === 4), true);
  assert.equal(questions.every((item) => item.source?.includes("オリジナル問題")), true);
  for (const objective of ["101.1", "101.2", "101.3", "102.1", "102.2", "102.3", "102.4", "102.5", "102.6", "103.1", "103.2", "103.3", "103.4", "103.5", "103.6", "103.7", "103.8", "104.1", "104.2", "104.3", "104.5", "104.6", "104.7"]) {
    assert.equal(
      questions.some((item) => item.subcategory?.startsWith(objective)),
      true,
      `${objective} の問題がありません`,
    );
  }
});

test("個別日と曜日指定を学習しない日として統合する", () => {
  const setup: Setup = {
    name: "LPIC-1 101",
    examDate: "2026-10-12",
    dailyNewLimit: 10,
    dailyQuestionLimit: 20,
    bufferRate: 20,
    instantThresholdSeconds: 30,
    dailyMinimumQuestions: 15,
    reservedDates: ["2026-10-07"],
    reservedWeekdays: [0, 6],
    setupCompleted: true,
    createdAt: "2026-10-05T00:00:00.000Z",
    updatedAt: "2026-10-05T00:00:00.000Z",
  };
  assert.deepEqual(
    getEffectiveReservedDates(setup, new Date("2026-10-05T00:00:00")),
    ["2026-10-07", "2026-10-10", "2026-10-11"],
  );
});
