import assert from "node:assert/strict";
import test from "node:test";
import {
  parseQuestionCsv,
  questionsFromPreview,
} from "../src/services/csvImportService.ts";
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

test("CSVから択一・複数選択・入力回答をまとめて取り込む", () => {
  const csv = [
    "id,category,text,questionType,choice1,choice2,choice3,answer,answers,acceptedAnswers,explanation,source",
    "S-1,Linux,択一問題,single,A,B,,2,,,解説,出典",
    "M-1,Linux,複数問題,multiple,A,B,C,,1|3,,解説,出典",
    "T-1,Linux,入力問題,text,,,,,,LVM|lvm,解説,出典",
  ].join("\n");
  const result = parseQuestionCsv(csv, []);
  assert.equal(result.errorCount, 0);
  const imported = questionsFromPreview(result);
  assert.equal(imported.length, 3);
  assert.equal(imported[0].answerIndex, 1);
  assert.deepEqual(imported[1].answerIndices, [0, 2]);
  assert.deepEqual(imported[2].choices, []);
  assert.deepEqual(imported[2].acceptedAnswers, ["LVM", "lvm"]);
});

test("CSVは回答方式ごとの必須回答を検証する", () => {
  const csv = [
    "id,category,text,questionType,choice1,choice2,answers,acceptedAnswers",
    "M-1,Linux,複数問題,multiple,A,B,1|1,",
    "T-1,Linux,入力問題,text,,,,",
  ].join("\n");
  const result = parseQuestionCsv(csv, []);
  assert.equal(result.errorCount, 2);
  assert.match(result.rows[0].messages.join(" "), /重複/);
  assert.match(result.rows[1].messages.join(" "), /acceptedAnswers/);
});

test("CSVは引用符の位置・閉じた引用符後の余計な文字・総容量を拒否する", () => {
  const afterQuote = parseQuestionCsv(
    'id,category,text,choice1,choice2,answer\nQ-1,Linux,"問題"x,A,B,1',
    [],
  );
  assert.match(afterQuote.fatalErrors.join(" "), /余計な文字/);

  const middleQuote = parseQuestionCsv(
    'id,category,text,choice1,choice2,answer\nQ-1,Linux,問"題,A,B,1',
    [],
  );
  assert.match(middleQuote.fatalErrors.join(" "), /フィールドの先頭/);

  const oversized = parseQuestionCsv("x".repeat(5 * 1024 * 1024 + 1), []);
  assert.match(oversized.fatalErrors.join(" "), /5MB以下/);
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

test("完全バックアップは複数選択・入力回答の問題を復元できる", () => {
  const questions = [
    {
      id: "M-1",
      examScopeId: "lpic101",
      category: "Linux",
      text: "複数問題",
      questionType: "multiple",
      choices: ["A", "B", "C"],
      answerIndex: 0,
      answerIndices: [0, 2],
      explanation: "解説",
      weight: 1,
      difficulty: 2,
    },
    {
      id: "T-1",
      examScopeId: "lpic101",
      category: "Linux",
      text: "入力問題",
      questionType: "text",
      choices: [],
      answerIndex: 0,
      acceptedAnswers: ["LVM"],
      explanation: "解説",
      weight: 1,
      difficulty: 2,
    },
  ];
  const backup = parseFullBackup(JSON.stringify({
    format: "study-quiz-full-backup",
    version: 6,
    appVersion: "4.4.0",
    exportedAt: "2026-10-10T00:00:00.000Z",
    entries: { "study-quiz-questions-v1": JSON.stringify(questions) },
  }));
  assert.deepEqual(JSON.parse(backup.entries["study-quiz-questions-v1"]), questions);
});

