import assert from "node:assert/strict";
import test from "node:test";
import {
  detectForgettingCandidates,
  selectForgettingQuestions,
} from "../src/services/forgettingDetectionService.ts";
import { createFinalReviewPlan } from "../src/services/finalReviewService.ts";
import {
  analyzeResponseSpeed,
  selectSlowQuestions,
} from "../src/services/responseSpeedAnalysisService.ts";
import {
  analyzeWeakQuestions,
  selectWeakQuestions,
} from "../src/services/weakQuestionService.ts";
import type { Question } from "../src/types/Question.ts";
import type { StudyHistory } from "../src/types/StudyHistory.ts";

const question: Question = {
  id: "Q-1",
  examScopeId: "lpic101",
  category: "Linux",
  text: "question",
  choices: ["A", "B"],
  answerIndex: 0,
  explanation: "",
  weight: 1,
  difficulty: 1,
};
const answer = (id: string, answeredAt: string, correct = false): StudyHistory => ({
  id,
  questionId: question.id,
  category: question.category,
  selectedIndex: 1,
  correct,
  answeredAt,
  responseTimeSeconds: 10,
  instantScore: 0.2,
});
const now = new Date("2026-10-10T12:00:00.000Z");

test("分析サービスは未来・不正日時とアーカイブ問題を除外する", () => {
  const invalidHistory = [
    answer("future", "2026-10-11T00:00:00.000Z"),
    answer("invalid", "invalid"),
  ];
  assert.deepEqual(analyzeWeakQuestions([question], invalidHistory, now), []);
  assert.deepEqual(analyzeResponseSpeed([question], invalidHistory, now), []);
  assert.deepEqual(detectForgettingCandidates([question], invalidHistory, now), []);

  const archived = { ...question, archivedAt: "2026-10-09T00:00:00.000Z" };
  const validHistory = [answer("valid", "2026-10-10T00:00:00.000Z")];
  assert.deepEqual(analyzeWeakQuestions([archived], validHistory, now), []);
  assert.deepEqual(analyzeResponseSpeed([archived], validHistory, now), []);
});

test("上限0件は分析・最終復習で1問へ切り上げない", () => {
  const validHistory = Array.from({ length: 4 }, (_, index) =>
    answer(`H-${index}`, `2026-10-0${index + 1}T00:00:00.000Z`),
  );
  assert.deepEqual(selectWeakQuestions([question], validHistory, 0), []);
  assert.deepEqual(
    selectForgettingQuestions([question], validHistory, 0),
    [],
  );
  assert.deepEqual(
    selectSlowQuestions(analyzeResponseSpeed([question], validHistory, now), 0),
    [],
  );
  const plan = createFinalReviewPlan([question], validHistory, [], 10, 0, now);
  assert.equal(plan.questions.length, 0);
  assert.equal(plan.estimatedMinutes, 0);
});
