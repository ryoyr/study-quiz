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
  categories: ["104 デバイスとファイルシステム"],
  masteryFilters: ["UNLEARNED"],
  questionModes: ["ALL"],
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
  assert.equal(filtered.every((item) => selection.categories.includes(item.category)), true);
  assert.equal(filtered.some((item) => item.id === learned.questionId), false);
});

test("個別指定した問題だけでセッションを作成する", () => {
  const setup = { ...createDefaultSetup(), dailyQuestionLimit: 20 };
  const selected: StudySelection = { ...selection, categories: ["ALL"], masteryFilters: ["ALL"], questionIds: ["LPIC101-001", "LPIC101-100"] };
  const session = generateSelectedStudySession(questions, [], setup, [], selected, new Date("2026-10-06T00:00:00.000Z"));
  assert.deepEqual(session.items.map((item) => item.question.id).sort(), selected.questionIds);
  assert.equal(session.otherCount, 2);
});

test("複数の学習範囲をまとめて絞り込む", () => {
  const categories = [
    "101 システムアーキテクチャ",
    "104 デバイスとファイルシステム",
  ];
  const filtered = filterStudyQuestions(questions, [], {
    ...selection,
    categories,
    masteryFilters: ["ALL"],
  });
  assert.equal(filtered.length > 0, true);
  assert.equal(filtered.every((item) => categories.includes(item.category)), true);
  assert.equal(new Set(filtered.map((item) => item.category)).size, 2);
});

test("複数の理解度をOR条件で絞り込む", () => {
  const states: QuestionState[] = [
    {
      questionId: "LPIC101-001", correctCount: 1, incorrectCount: 0, totalCount: 1,
      averageResponseTimeSeconds: 10, recentResponseTimeSeconds: 10, averageInstantScore: 0.7,
      recentInstantScore: 0.7, recentIncorrect: false, lastAnsweredAt: "2026-10-05T00:00:00.000Z",
      masteryLevel: "LEARNING", fsrsCard: null, nextReviewAt: null, fsrsStability: 0, fsrsDifficulty: 0,
    },
    {
      questionId: "LPIC101-002", correctCount: 3, incorrectCount: 0, totalCount: 3,
      averageResponseTimeSeconds: 8, recentResponseTimeSeconds: 8, averageInstantScore: 0.9,
      recentInstantScore: 0.9, recentIncorrect: false, lastAnsweredAt: "2026-10-05T00:00:00.000Z",
      masteryLevel: "MASTERED", fsrsCard: null, nextReviewAt: null, fsrsStability: 0, fsrsDifficulty: 0,
    },
  ];
  const filtered = filterStudyQuestions(questions, states, {
    ...selection,
    categories: ["ALL"],
    masteryFilters: ["LEARNING", "MASTERED"],
  });
  assert.equal(filtered.some((item) => item.id === "LPIC101-001"), true);
  assert.equal(filtered.some((item) => item.id === "LPIC101-002"), true);
  assert.equal(filtered.some((item) => item.id === "LPIC101-003"), false);
});

test("複数の出題方法を重複なく統合する", () => {
  const setup = { ...createDefaultSetup(), dailyQuestionLimit: 100 };
  const history: StudyHistory[] = [
    { id: "H1", questionId: "LPIC101-001", category: "101", selectedIndex: 0, correct: false, answeredAt: "2026-10-05T01:00:00.000Z", responseTimeSeconds: 60, instantScore: 0 },
    { id: "H2", questionId: "LPIC101-001", category: "101", selectedIndex: 0, correct: false, answeredAt: "2026-10-05T02:00:00.000Z", responseTimeSeconds: 50, instantScore: 0 },
  ];
  const states: QuestionState[] = [{
    questionId: "LPIC101-001", correctCount: 0, incorrectCount: 2, totalCount: 2,
    averageResponseTimeSeconds: 55, recentResponseTimeSeconds: 50, averageInstantScore: 0,
    recentInstantScore: 0, recentIncorrect: true, lastAnsweredAt: "2026-10-05T02:00:00.000Z",
    masteryLevel: "LEARNING", fsrsCard: null, nextReviewAt: "2026-10-05T03:00:00.000Z", fsrsStability: 0, fsrsDifficulty: 0,
  }];
  const session = generateSelectedStudySession(questions, history, setup, states, {
    ...selection,
    categories: ["ALL"],
    masteryFilters: ["ALL"],
    questionModes: ["NEW", "REVIEW", "WEAK"],
  }, new Date("2026-10-06T00:00:00.000Z"));
  const ids = session.items.map((item) => item.question.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.includes("LPIC101-001"), true);
  assert.equal(session.items.some((item) => item.sourceTypes.includes("NEW")), true);
  assert.equal(session.items.find((item) => item.question.id === "LPIC101-001")?.sourceTypes.includes("REVIEW"), true);
  assert.equal(session.items.find((item) => item.question.id === "LPIC101-001")?.sourceTypes.includes("WEAK"), true);
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
