import assert from "node:assert/strict";
import test from "node:test";
import { parseQuestionCsv } from "../src/services/csvImportService.ts";
import { parseFullBackup } from "../src/services/fullBackupService.ts";

test("CSVからサブカテゴリ・出典・タグ・可変選択肢を取り込む", () => {
  const csv = [
    "id,category,subcategory,text,choice1,choice2,choice3,choice4,choice5,answer,explanation,source,tags,weight,difficulty",
    "Q-1,Linux,権限,正しいものは？,A,B,C,D,E,5,解説,公式資料,基本|権限,3,2",
  ].join("\n");
  const result = parseQuestionCsv(csv, []);
  assert.equal(result.errorCount, 0);
  assert.equal(result.validCount, 1);
  assert.equal(result.rows[0].question?.choices.length, 5);
  assert.deepEqual(result.rows[0].question?.tags, ["基本", "権限"]);
  assert.equal(result.rows[0].question?.source, "公式資料");
});

test("CSV内の重複IDと存在しない正解番号を拒否する", () => {
  const csv = [
    "id,category,text,choice1,choice2,answer",
    "Q-1,Linux,問題1,A,B,3",
    "Q-1,Linux,問題2,A,B,1",
  ].join("\n");
  const result = parseQuestionCsv(csv, []);
  assert.equal(result.errorCount, 2);
});

test("旧バックアップの回答履歴キーを現行キーへ移行する", () => {
  const backup = parseFullBackup(
    JSON.stringify({
      format: "study-quiz-full-backup",
      version: 2,
      exportedAt: "2026-10-04T00:00:00.000Z",
      entries: { "study-quiz-history-v1": "[]" },
    }),
  );
  assert.equal(backup.version, 9);
  assert.equal(backup.entries["study-quiz-answer-history-v1"], "[]");
  assert.equal(backup.entries["study-quiz-history-v1"], undefined);
});

test("完全バックアップは不正な問題データを復元前に拒否する", () => {
  assert.throws(
    () =>
      parseFullBackup(
        JSON.stringify({
          format: "study-quiz-full-backup",
          version: 6,
          appVersion: "1.0.0",
          exportedAt: "2026-10-05T00:00:00.000Z",
          entries: {
            "study-quiz-questions-v1": JSON.stringify([
              {
                id: "Q-1",
                category: "Linux",
                text: "問題",
                choices: ["A"],
                answerIndex: 3,
                explanation: "",
                weight: 1,
                difficulty: 1,
              },
            ]),
          },
        }),
      ),
    /問題データが不正/,
  );
});


test("旧バックアップの問題と設定へLPIC試験枠を補完する", () => {
  const setup = {
    name: "LPIC-1 101",
    examDate: "2099-12-31",
    dailyNewLimit: 10,
    dailyQuestionLimit: 20,
    bufferRate: 20,
    instantThresholdSeconds: 30,
    dailyMinimumQuestions: 15,
    reservedDates: [],
    setupCompleted: true,
    createdAt: "2026-10-05T00:00:00.000Z",
    updatedAt: "2026-10-05T00:00:00.000Z",
  };
  const legacyQuestion = {
    id: "OLD-1",
    category: "101 システムアーキテクチャ",
    text: "問題",
    choices: ["A", "B"],
    answerIndex: 0,
    explanation: "解説",
    weight: 1,
    difficulty: 1,
  };
  const backup = parseFullBackup(JSON.stringify({
    format: "study-quiz-full-backup",
    version: 5,
    appVersion: "2.0.0",
    exportedAt: "2026-10-05T00:00:00.000Z",
    entries: {
      "study-quiz-setup-v1": JSON.stringify(setup),
      "study-quiz-questions-v1": JSON.stringify([legacyQuestion]),
    },
  }));
  const restoredSetup = JSON.parse(backup.entries["study-quiz-setup-v1"]);
  const restoredQuestions = JSON.parse(backup.entries["study-quiz-questions-v1"]);
  assert.equal(backup.version, 9);
  assert.equal(restoredSetup.examScopeId, "lpic101");
  assert.equal(restoredSetup.defaultQuestionMode, "ADAPTIVE");
  assert.deepEqual(restoredSetup.defaultMasteryFilters, ["ALL"]);
  assert.deepEqual(restoredSetup.defaultQuestionModes, ["ADAPTIVE"]);
  assert.equal(restoredQuestions[0].examScopeId, "lpic101");
});

