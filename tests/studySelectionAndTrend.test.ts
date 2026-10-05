import assert from "node:assert/strict";
import test from "node:test";
import { questions } from "../src/data/questions.ts";
import { buildLearningTrend } from "../src/services/learningTrendService.ts";
import { filterStudyQuestions, generateSelectedStudySession, type StudySelection } from "../src/services/studySelectionService.ts";
import { createDefaultSetup } from "../src/types/Setup.ts";
import type { QuestionState } from "../src/types/QuestionState.ts";
import type { StudyHistory } from "../src/types/StudyHistory.ts";

const selection: StudySelection = {
  examScopeId: "lpic101",
  category: "104 デバイスとファイルシステム",
  masteryFilter: "UNLEARNED",
  questionMode: "ALL",
  questionIds: [],
};

test("試験枠・カテゴリ・理解度で問題を絞り込む", () => {
  const learned: QuestionState = {
    questionId: "LPIC101-045", correctCount: 1, incorrectCount: 0, totalCount: 1,
    averageResponseTimeSeconds: 10, recentResponseTimeSeconds: 10, averageInstantScore: 0.7,
    recentInstantScore: 0.7, recentIncorrect: false, lastAnsweredAt: "2026-10-05T00:00:00.000Z",
    masteryLevel: "LEARNING", fsrsCard: null, nextReviewAt: null, fsrsStability: 0, fsrsDifficulty: 0,
  };
  const filtered = filterStudyQuestions(questions, [learned], selection);
  assert.equal(filtered.every((item) => item.examScopeId === "lpic101"), true);
  assert.equal(filtered.every((item) => item.category === selection.category), true);
  assert.equal(filtered.some((item) => item.id === learned.questionId), false);
});

test("個別指定した問題だけでセッションを作成する", () => {
  const setup = { ...createDefaultSetup(), dailyQuestionLimit: 20 };
  const selected = { ...selection, category: "ALL", masteryFilter: "ALL" as const, questionIds: ["LPIC101-001", "LPIC101-100"] };
  const session = generateSelectedStudySession(questions, [], setup, [], selected, new Date("2026-10-06T00:00:00.000Z"));
  assert.deepEqual(session.items.map((item) => item.question.id).sort(), selected.questionIds);
  assert.equal(session.otherCount, 2);
});

test("日別回答数と理解度の累積推移を再構成する", () => {
  const history: StudyHistory[] = [
    { id: "H1", questionId: "LPIC101-001", category: "101", selectedIndex: 0, correct: true, answeredAt: "2026-10-05T01:00:00.000Z", responseTimeSeconds: 10, instantScore: 0.8 },
    { id: "H2", questionId: "LPIC101-001", category: "101", selectedIndex: 0, correct: true, answeredAt: "2026-10-05T02:00:00.000Z", responseTimeSeconds: 9, instantScore: 0.8 },
    { id: "H3", questionId: "LPIC101-001", category: "101", selectedIndex: 0, correct: true, answeredAt: "2026-10-06T01:00:00.000Z", responseTimeSeconds: 8, instantScore: 0.8 },
  ];
  const trend = buildLearningTrend(history, questions.slice(0, 2), 2, new Date("2026-10-06T12:00:00.000Z"));
  assert.deepEqual(trend.map((item) => item.answers), [2, 1]);
  assert.equal(trend[0].learning, 1);
  assert.equal(trend[1].mastered, 1);
  assert.equal(trend[1].unlearned, 1);
});
