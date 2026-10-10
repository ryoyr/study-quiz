import assert from "node:assert/strict";
import test from "node:test";
import { calculateStudyStreak } from "../src/services/streakService.ts";
import type { StudyHistory } from "../src/types/StudyHistory.ts";

const history = (id: string, answeredAt: string): StudyHistory => ({
  id,
  questionId: "Q-1",
  category: "Linux",
  selectedIndex: 0,
  correct: true,
  answeredAt,
  responseTimeSeconds: 1,
  instantScore: 1,
});

test("未来履歴を連続学習日・最終学習日へ含めない", () => {
  const result = calculateStudyStreak(
    [
      history("H-today", "2026-10-10T01:00:00.000Z"),
      history("H-future", "2026-10-12T01:00:00.000Z"),
    ],
    [],
    new Date("2026-10-10T12:00:00.000Z"),
  );
  assert.equal(result.totalStudyDays, 1);
  assert.equal(result.lastStudyDate, "2026-10-10");
  assert.equal(result.currentDays, 1);
});
