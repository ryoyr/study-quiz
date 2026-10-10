import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateRequiredNewCount,
  generateStudySession,
} from "../src/services/sessionGenerator.ts";
import type { Question } from "../src/types/Question.ts";
import type { Setup } from "../src/types/Setup.ts";

const setup: Setup = {
  name: "LinuC 101",
  examDate: "2026-10-15",
  dailyNewLimit: 10,
  dailyQuestionLimit: 20,
  bufferRate: 20,
  instantThresholdSeconds: 30,
  dailyMinimumQuestions: 15,
  reservedDates: ["2026-10-06", "2026-10-07"],
  examScopeId: "lpic101",
  defaultCategory: "ALL",
  defaultCategories: ["ALL"],
  defaultMasteryFilter: "ALL",
  defaultMasteryFilters: ["ALL"],
  defaultQuestionMode: "ADAPTIVE",
  defaultQuestionModes: ["ADAPTIVE"],
  defaultQuestionIds: [],
  theme: "system",
  visualTheme: "aurora",
  setupCompleted: true,
  createdAt: "2026-10-04T00:00:00.000Z",
  updatedAt: "2026-10-04T00:00:00.000Z",
};

test("予約日を除外し、バッファ率を加えた必要新規数を算出する", () => {
  const result = calculateRequiredNewCount(
    45,
    setup,
    new Date("2026-10-04T13:10:04.000Z"),
  );
  assert.deepEqual(result, { effectiveDays: 9, requiredNewCount: 6 });
});

test("必要新規数は1日の新規上限を超えない", () => {
  const result = calculateRequiredNewCount(
    500,
    setup,
    new Date("2026-10-04T13:10:04.000Z"),
  );
  assert.equal(result.requiredNewCount, 10);
});

test("未来履歴を未回答判定へ混ぜず、アーカイブ問題を出題しない", () => {
  const active: Question = {
    id: "Q-active",
    examScopeId: "lpic101",
    category: "Linux",
    text: "active",
    choices: ["A", "B"],
    answerIndex: 0,
    explanation: "",
    weight: 1,
    difficulty: 1,
  };
  const archived: Question = {
    ...active,
    id: "Q-archived",
    archivedAt: "2026-10-09T00:00:00.000Z",
  };
  const session = generateStudySession(
    [active, archived],
    [
      {
        id: "H-future",
        questionId: active.id,
        category: "Linux",
        selectedIndex: 0,
        correct: true,
        answeredAt: "2026-10-11T00:00:00.000Z",
        responseTimeSeconds: 1,
        instantScore: 1,
      },
    ],
    setup,
    [],
    new Date("2026-10-10T12:00:00.000Z"),
  );
  assert.deepEqual(session.items.map((item) => item.question.id), [active.id]);
  assert.equal(session.remainingNewQuestions, 1);
});

test("候補0件のセッションは0問・0分で返す", () => {
  const session = generateStudySession(
    [],
    [],
    setup,
    [],
    new Date("2026-10-10T12:00:00.000Z"),
  );
  assert.equal(session.totalCount, 0);
  assert.equal(session.estimatedMinutes, 0);
});
