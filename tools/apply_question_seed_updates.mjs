#!/usr/bin/env node
import {
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const FORMAT = "study-quiz-question-seed-updates";
const VERSION = 1;
const MAX_JSON_BYTES = 5 * 1024 * 1024;
const MAX_UPDATES = 10_000;
const LIMITS = {
  id: 200,
  examScopeId: 200,
  shortText: 500,
  longText: 20_000,
  maxChoices: 8,
  maxTags: 30,
  maxAcceptedAnswers: 100,
};
const QUESTION_TYPES = new Set(["single", "multiple", "text"]);

const isRecord = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isNonEmptyString = (value, maxLength) =>
  typeof value === "string" &&
  value.trim().length > 0 &&
  value.length <= maxLength;
const isOptionalString = (value, maxLength) =>
  value === undefined ||
  (typeof value === "string" && value.length <= maxLength);
const isTimestamp = (value) =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T/u.test(value) &&
  Number.isFinite(Date.parse(value));

const questionValidationErrors = (value) => {
  if (!isRecord(value)) return ["問題データがオブジェクトではありません。"];

  const errors = [];
  const questionType = value.questionType ?? "single";

  if (!isNonEmptyString(value.id, LIMITS.id))
    errors.push(`問題IDは必須で、${LIMITS.id}文字以内です。`);
  if (!isNonEmptyString(value.examScopeId, LIMITS.examScopeId))
    errors.push(`試験枠IDは必須で、${LIMITS.examScopeId}文字以内です。`);
  if (!isNonEmptyString(value.category, LIMITS.shortText))
    errors.push(`カテゴリは必須で、${LIMITS.shortText}文字以内です。`);
  if (!isOptionalString(value.subcategory, LIMITS.shortText))
    errors.push(`サブカテゴリは${LIMITS.shortText}文字以内です。`);
  if (!isNonEmptyString(value.text, LIMITS.longText))
    errors.push(`問題文は必須で、${LIMITS.longText.toLocaleString()}文字以内です。`);
  if (!QUESTION_TYPES.has(questionType)) errors.push("回答方式が不正です。");

  if (QUESTION_TYPES.has(questionType)) {
    const minimumChoices = questionType === "text" ? 0 : 2;
    if (
      !Array.isArray(value.choices) ||
      value.choices.length < minimumChoices ||
      value.choices.length > LIMITS.maxChoices
    ) {
      errors.push(
        minimumChoices === 0
          ? `選択肢は${LIMITS.maxChoices}件以下で指定してください。`
          : `選択問題には${minimumChoices}～${LIMITS.maxChoices}件の選択肢が必要です。`,
      );
    } else {
      if (
        !value.choices.every((choice) =>
          isNonEmptyString(choice, LIMITS.longText),
        )
      ) {
        errors.push(
          `選択肢は空欄にせず、各${LIMITS.longText.toLocaleString()}文字以内で指定してください。`,
        );
      }
      if (new Set(value.choices).size !== value.choices.length)
        errors.push("同一内容の選択肢は重複して指定できません。");
    }

    if (questionType === "text") {
      if (
        !Array.isArray(value.acceptedAnswers) ||
        value.acceptedAnswers.length === 0 ||
        value.acceptedAnswers.length > LIMITS.maxAcceptedAnswers ||
        !value.acceptedAnswers.every((answer) =>
          isNonEmptyString(answer, LIMITS.longText),
        )
      ) {
        errors.push(
          `入力問題には1～${LIMITS.maxAcceptedAnswers}件の許容回答が必要です（各${LIMITS.longText.toLocaleString()}文字以内）。`,
        );
      }
    } else {
      const choices = Array.isArray(value.choices) ? value.choices : [];
      if (
        !Number.isInteger(value.answerIndex) ||
        value.answerIndex < 0 ||
        value.answerIndex >= choices.length
      ) {
        errors.push("正解の選択肢指定が不正です。");
      }
      if (
        questionType === "multiple" &&
        (!Array.isArray(value.answerIndices) ||
          value.answerIndices.length === 0 ||
          new Set(value.answerIndices).size !== value.answerIndices.length ||
          !value.answerIndices.every(
            (index) =>
              Number.isInteger(index) &&
              index >= 0 &&
              index < choices.length,
          ))
      ) {
        errors.push(
          "複数選択問題の正解は、重複のない選択肢番号で1件以上指定してください。",
        );
      }
    }
  }

  if (
    typeof value.explanation !== "string" ||
    value.explanation.length > LIMITS.longText
  ) {
    errors.push(`解説は${LIMITS.longText.toLocaleString()}文字以内です。`);
  }
  if (!isOptionalString(value.source, LIMITS.longText))
    errors.push(`出典は${LIMITS.longText.toLocaleString()}文字以内です。`);
  if (
    value.tags !== undefined &&
    (!Array.isArray(value.tags) ||
      value.tags.length > LIMITS.maxTags ||
      !value.tags.every((tag) => isNonEmptyString(tag, LIMITS.shortText)))
  ) {
    errors.push(
      `タグは${LIMITS.maxTags}件以下、各${LIMITS.shortText}文字以内です。`,
    );
  }
  if (
    typeof value.weight !== "number" ||
    !Number.isFinite(value.weight) ||
    value.weight <= 0
  ) {
    errors.push("出題ウェイトは0より大きい数値です。");
  }
  if (
    !Number.isInteger(value.difficulty) ||
    value.difficulty < 1 ||
    value.difficulty > 5
  ) {
    errors.push("難易度は1～5の整数です。");
  }
  if (
    value.archivedAt !== undefined &&
    (typeof value.archivedAt !== "string" ||
      !Number.isFinite(Date.parse(value.archivedAt)))
  ) {
    errors.push("アーカイブ日時が不正です。");
  }

  return errors;
};

const readJsonFile = (path) => {
  if (statSync(path).size > MAX_JSON_BYTES)
    throw new Error("更新JSONは5MB以下にしてください。");
  return JSON.parse(readFileSync(path, "utf8"));
};

const readSeedIds = (questionsPath) => {
  const source = readFileSync(questionsPath, "utf8");
  const ids = new Set(
    [...source.matchAll(/\bq\(\s*["']([^"']+)["']/gu)].map(
      (match) => match[1],
    ),
  );
  if (ids.size === 0)
    throw new Error("questions.tsから初期問題IDを取得できません。");
  return ids;
};

const readExistingOverrides = (outputPath, seedIds) => {
  const source = readFileSync(outputPath, "utf8");
  const match = source.match(
    /export\s+const\s+questionQualityOverrides\s*:[^=]+?=\s*(\[[\s\S]*\])\s*;\s*$/u,
  );
  if (!match)
    throw new Error("既存のquestionQualityOverrides.tsを解析できません。");

  const values = JSON.parse(match[1]);
  if (!Array.isArray(values))
    throw new Error("既存の初期問題上書きが配列ではありません。");

  const existing = new Map();
  for (const [index, question] of values.entries()) {
    const errors = questionValidationErrors(question);
    if (errors.length > 0)
      throw new Error(
        `既存上書き${index + 1}件目が不正です: ${errors.join(" / ")}`,
      );
    if (!seedIds.has(question.id))
      throw new Error(`既存上書き ${question.id} がquestions.tsに存在しません。`);
    if (existing.has(question.id))
      throw new Error(`既存上書き ${question.id} が重複しています。`);
    existing.set(question.id, question);
  }
  return existing;
};

const validatePack = (pack, seedIds) => {
  if (
    !isRecord(pack) ||
    pack.format !== FORMAT ||
    pack.version !== VERSION ||
    !isNonEmptyString(pack.appVersion, 100) ||
    !isTimestamp(pack.exportedAt) ||
    !Array.isArray(pack.updates)
  ) {
    throw new Error("更新JSONの形式が不正です。");
  }
  if (pack.updates.length > MAX_UPDATES)
    throw new Error("更新件数が上限を超えています。");

  const updates = new Map();
  for (const [index, item] of pack.updates.entries()) {
    if (
      !isRecord(item) ||
      !isNonEmptyString(item.questionId, LIMITS.id) ||
      !isNonEmptyString(item.proposalId, LIMITS.id) ||
      !isTimestamp(item.appliedAt)
    ) {
      throw new Error(`${index + 1}件目の更新メタデータが不正です。`);
    }
    if (updates.has(item.questionId))
      throw new Error(`更新対象 ${item.questionId} が重複しています。`);
    if (!seedIds.has(item.questionId))
      throw new Error(`初期問題 ${item.questionId} がquestions.tsに存在しません。`);

    for (const [label, question] of [
      ["更新前", item.beforeQuestion],
      ["更新後", item.question],
    ]) {
      const errors = questionValidationErrors(question);
      if (errors.length > 0)
        throw new Error(
          `${item.questionId} の${label}問題形式が不正です: ${errors.join(" / ")}`,
        );
      if (question.id !== item.questionId)
        throw new Error(`${item.questionId} の${label}問題IDが一致しません。`);
    }
    updates.set(item.questionId, item.question);
  }
  return updates;
};

const renderOverrides = (questions) =>
  `import type { Question } from "../types/Question";\n\n/** レビュー適用済みの初期問題上書き。生成ツール以外では直接編集しない。 */\nexport const questionQualityOverrides: Question[] = ${JSON.stringify(questions, null, 2)};\n`;

const main = () => {
  const packArgument = process.argv[2];
  if (!packArgument)
    throw new Error(
      "使用法: node tools/apply_question_seed_updates.mjs <更新JSON>",
    );

  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const questionsPath = resolve(root, "src/data/questions.ts");
  const outputPath = resolve(root, "src/data/questionQualityOverrides.ts");
  const packPath = resolve(process.cwd(), packArgument);
  const seedIds = readSeedIds(questionsPath);
  const pack = readJsonFile(packPath);
  const updates = validatePack(pack, seedIds);
  const merged = readExistingOverrides(outputPath, seedIds);
  for (const [questionId, question] of updates) merged.set(questionId, question);
  const questions = [...merged.values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  );

  const temporary = `${outputPath}.tmp-${process.pid}-${Date.now()}`;
  try {
    writeFileSync(temporary, renderOverrides(questions), "utf8");
    renameSync(temporary, outputPath);
  } finally {
    rmSync(temporary, { force: true });
  }
  console.log(
    `${updates.size}件を適用し、${questions.length}件の初期問題上書きを出力しました。`,
  );
};

try {
  main();
} catch (error) {
  console.error(
    `初期問題上書きを更新できません: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exitCode = 1;
}
