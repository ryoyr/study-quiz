import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSimilarQuestionPrompt,
  parseSimilarQuestionDraft,
  validateSimilarQuestion,
} from "../src/services/similarQuestionService.ts";
import type { Question } from "../src/types/Question.ts";

const baseQuestion: Question = {
  id: "Q-1",
  examScopeId: "lpic101",
  category: "Linux",
  subcategory: "権限",
  text: "chmod 755の説明として正しいものはどれか。",
  choices: ["所有者だけ実行可能", "全員が書込可能", "所有者は全権限"],
  answerIndex: 2,
  explanation: "7はrwxを表します。",
  source: "公式マニュアル",
  tags: ["基本"],
  weight: 3,
  difficulty: 2,
};

const validJson = JSON.stringify({
  questionType: "single",
  category: "Linux",
  subcategory: "権限",
  text: "chmod 640でグループに与えられる権限はどれか。",
  choices: ["なし", "読取のみ", "読取と書込"],
  answerNumber: 2,
  explanation: "640の第2桁4は読取権限です。",
  source: "公式マニュアル",
  tags: ["基本", "類似問題"],
  weight: 3,
  difficulty: 2,
});

test("元問題の文脈と回答方式別JSON契約を含むプロンプトを生成する", () => {
  const prompt = buildSimilarQuestionPrompt(baseQuestion);
  assert.match(prompt, /元問題ID: Q-1/);
  assert.match(prompt, /answerNumberは1始まり/);
  assert.match(prompt, /正答: 選択肢3: 所有者は全権限/);
  assert.match(prompt, /"questionType":"single"/);
});

test("AI回答JSONを検証し、一意な問題IDを採番する", () => {
  const draft = parseSimilarQuestionDraft(validJson, baseQuestion, [
    baseQuestion,
    { ...baseQuestion, id: "Q-1-SIM-01", text: "既存案" },
  ]);
  assert.equal(draft.id, "Q-1-SIM-02");
  assert.equal(draft.answerIndex, 1);
  assert.deepEqual(draft.tags, ["基本", "類似問題"]);
});

test("Markdownコードフェンス付きJSONも読み取る", () => {
  const draft = parseSimilarQuestionDraft(
    `\`\`\`json\n${validJson}\n\`\`\``,
    baseQuestion,
    [baseQuestion],
  );
  assert.equal(draft.id, "Q-1-SIM-01");
});

test("元問題と同一の問題文、重複選択肢、重複IDを拒否する", () => {
  const candidate = parseSimilarQuestionDraft(validJson, baseQuestion, [
    baseQuestion,
  ]);
  assert.throws(
    () =>
      validateSimilarQuestion(
        { ...candidate, text: baseQuestion.text },
        baseQuestion,
        [baseQuestion],
      ),
    /元問題と同一/,
  );
  assert.throws(
    () =>
      validateSimilarQuestion(
        { ...candidate, choices: ["同じ", "同じ"], answerIndex: 0 },
        baseQuestion,
        [baseQuestion],
      ),
    /同一内容の選択肢/,
  );
  assert.throws(
    () => validateSimilarQuestion(candidate, baseQuestion, [candidate]),
    /既に使用/,
  );
});

test("選択肢範囲外のanswerNumberを拒否する", () => {
  const invalid = JSON.stringify({
    ...JSON.parse(validJson),
    answerNumber: 9,
  });
  assert.throws(
    () => parseSimilarQuestionDraft(invalid, baseQuestion, [baseQuestion]),
    /answerNumberは1～3/,
  );
});

test("複数選択問題の類似案を生成・検証できる", () => {
  const multipleBase: Question = {
    ...baseQuestion,
    id: "M-1",
    questionType: "multiple",
    answerIndex: 0,
    answerIndices: [0, 2],
  };
  const prompt = buildSimilarQuestionPrompt(multipleBase);
  assert.match(prompt, /answerNumbersは1始まりの整数配列/);
  assert.match(prompt, /"questionType":"multiple"/);
  const draft = parseSimilarQuestionDraft(
    JSON.stringify({
      questionType: "multiple",
      category: "Linux",
      text: "正しい権限をすべて選べ。",
      choices: ["A", "B", "C"],
      answerNumbers: [1, 3],
      explanation: "AとCが正しい。",
      source: "公式",
      tags: ["類似"],
      weight: 2,
      difficulty: 3,
    }),
    multipleBase,
    [multipleBase],
  );
  assert.equal(draft.questionType, "multiple");
  assert.deepEqual(draft.answerIndices, [0, 2]);
  assert.equal(draft.answerIndex, 0);
});

test("入力問題の類似案を生成・検証できる", () => {
  const textBase: Question = {
    ...baseQuestion,
    id: "T-1",
    text: "論理ボリューム管理の略称を入力せよ。",
    questionType: "text",
    choices: [],
    answerIndex: 0,
    acceptedAnswers: ["LVM"],
  };
  const prompt = buildSimilarQuestionPrompt(textBase);
  assert.match(prompt, /acceptedAnswersは正答として許容する文字列配列/);
  assert.match(prompt, /"questionType":"text"/);
  const draft = parseSimilarQuestionDraft(
    JSON.stringify({
      questionType: "text",
      category: "Linux",
      text: "物理ボリュームの略称を入力せよ。",
      acceptedAnswers: ["PV", "pv"],
      explanation: "Physical Volumeの略称です。",
      source: "公式",
      tags: ["類似"],
      weight: 2,
      difficulty: 2,
    }),
    textBase,
    [textBase],
  );
  assert.equal(draft.questionType, "text");
  assert.deepEqual(draft.choices, []);
  assert.deepEqual(draft.acceptedAnswers, ["PV", "pv"]);
});

test("回答方式別の不正なAI回答を拒否する", () => {
  const multipleBase: Question = {
    ...baseQuestion,
    questionType: "multiple",
    answerIndices: [0, 2],
  };
  assert.throws(
    () =>
      parseSimilarQuestionDraft(
        JSON.stringify({
          questionType: "multiple",
          category: "Linux",
          text: "別問題",
          choices: ["A", "B"],
          answerNumbers: [1, 1],
          explanation: "解説",
          weight: 1,
          difficulty: 1,
        }),
        multipleBase,
        [multipleBase],
      ),
    /重複/,
  );
  assert.throws(
    () =>
      parseSimilarQuestionDraft(
        JSON.stringify({
          questionType: "text",
          category: "Linux",
          text: "別問題",
          acceptedAnswers: "LVM",
          explanation: "解説",
          weight: 1,
          difficulty: 1,
        }),
        baseQuestion,
        [baseQuestion],
      ),
    /文字列配列/,
  );
});
