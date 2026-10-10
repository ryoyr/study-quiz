import assert from "node:assert/strict";
import test from "node:test";
import {
  isQuestionState,
  rebuildQuestionStates,
  updateQuestionStates,
} from "../src/services/questionStateService.ts";
import type { QuestionState } from "../src/types/QuestionState.ts";
import type { StudyHistory } from "../src/types/StudyHistory.ts";

const history = (
  id: string,
  answeredAt: string,
  correct: boolean,
): StudyHistory => ({
  id,
  questionId: "Q-1",
  category: "Linux",
  selectedIndex: 0,
  correct,
  answeredAt,
  responseTimeSeconds: 10,
  instantScore: correct ? 0.8 : 0.2,
});

test("問題状態はカウンター不変条件とFSRSカード形式を検証する", () => {
  const valid: QuestionState = {
    questionId: "Q-1",
    correctCount: 1,
    incorrectCount: 0,
    totalCount: 1,
    averageResponseTimeSeconds: 10,
    recentResponseTimeSeconds: 10,
    averageInstantScore: 0.8,
    recentInstantScore: 0.8,
    recentIncorrect: false,
    lastAnsweredAt: "2026-10-10T00:00:00.000Z",
    masteryLevel: "LEARNING",
    fsrsCard: null,
    nextReviewAt: null,
    fsrsStability: 0,
    fsrsDifficulty: 0,
  };
  assert.equal(isQuestionState(valid), true);
  assert.equal(isQuestionState({ ...valid, totalCount: 2 }), false);
  assert.equal(isQuestionState({ ...valid, questionId: " " }), false);
  assert.equal(isQuestionState({ ...valid, fsrsCard: { due: "invalid" } }), false);
});

test("履歴再構築は数値時刻順を安定利用し、不正日時と未来履歴を除外する", () => {
  const rebuilt = rebuildQuestionStates(
    [
      history("H-future", "2026-10-11T00:00:00.000Z", true),
      history("H-invalid", "invalid", true),
      history("H-2", "2026-10-10T00:00:00.000Z", false),
      history("H-1", "2026-10-09T00:00:00.000Z", true),
    ],
    new Date("2026-10-10T12:00:00.000Z"),
  );
  assert.equal(rebuilt.length, 1);
  assert.equal(rebuilt[0].correctCount, 1);
  assert.equal(rebuilt[0].incorrectCount, 1);
  assert.equal(rebuilt[0].lastAnsweredAt, "2026-10-10T00:00:00.000Z");
});

test("状態更新時に重複問題状態を1件へ正規化する", () => {
  const base = rebuildQuestionStates(
    [history("H-1", "2026-10-09T00:00:00.000Z", true)],
    new Date("2026-10-10T00:00:00.000Z"),
  )[0];
  const updated = updateQuestionStates(
    [base, { ...base }],
    history("H-2", "2026-10-10T00:00:00.000Z", false),
  );
  assert.equal(updated.length, 1);
  assert.equal(updated[0].totalCount, 2);
});
