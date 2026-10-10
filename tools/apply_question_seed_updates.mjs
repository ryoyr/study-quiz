#!/usr/bin/env node
import { readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const [packPath] = process.argv.slice(2);
if (!packPath) {
  console.error("Usage: node tools/apply_question_seed_updates.mjs <seed-update-pack.json>");
  process.exit(2);
}

const root = resolve(import.meta.dirname, "..");
const questionsPath = resolve(root, "src/data/questions.ts");
const overridesPath = resolve(root, "src/data/questionQualityOverrides.ts");
const temporaryPath = `${overridesPath}.tmp`;
const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const isNonBlank = (value, max = 20_000) =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;
const isQuestion = (value) => {
  if (!isObject(value)) return false;
  const type = value.questionType ?? "single";
  if (
    !isNonBlank(value.id, 200) ||
    !isNonBlank(value.examScopeId, 200) ||
    !isNonBlank(value.category, 500) ||
    !isNonBlank(value.text) ||
    !["single", "multiple", "text"].includes(type) ||
    !Array.isArray(value.choices) ||
    !value.choices.every((item) => isNonBlank(item)) ||
    !Number.isInteger(value.answerIndex) ||
    !isNonBlank(value.explanation) ||
    !Number.isInteger(value.weight) ||
    value.weight < 1 ||
    !Number.isInteger(value.difficulty) ||
    value.difficulty < 1 ||
    value.difficulty > 5
  ) return false;
  if (type === "text")
    return value.choices.length === 0 && Array.isArray(value.acceptedAnswers) && value.acceptedAnswers.length > 0;
  if (value.choices.length < 2 || value.choices.length > 8) return false;
  if (new Set(value.choices).size !== value.choices.length) return false;
  if (type === "multiple")
    return Array.isArray(value.answerIndices) && value.answerIndices.length > 0 && new Set(value.answerIndices).size === value.answerIndices.length && value.answerIndices.every((index) => Number.isInteger(index) && index >= 0 && index < value.choices.length);
  return value.answerIndex >= 0 && value.answerIndex < value.choices.length;
};

const pack = JSON.parse(await readFile(resolve(packPath), "utf8"));
if (
  !isObject(pack) ||
  pack.format !== "study-quiz-question-seed-updates" ||
  pack.version !== 1 ||
  !Array.isArray(pack.updates)
) throw new Error("対応していない初期データ更新JSONです。");
if (pack.updates.length > 10_000) throw new Error("更新件数が上限を超えています。");

const questionSource = await readFile(questionsPath, "utf8");
const baseIds = new Set(
  [...questionSource.matchAll(/\bq\(\s*"([^"]+)"/gu)].map((match) => match[1]),
);
const overrideSource = await readFile(overridesPath, "utf8");
const arrayMatch = overrideSource.match(/questionQualityOverrides:\s*Question\[\]\s*=\s*(\[[\s\S]*\]);/u);
if (!arrayMatch) throw new Error("questionQualityOverrides.tsの形式が不正です。");
const existing = JSON.parse(arrayMatch[1]);
if (!Array.isArray(existing) || !existing.every(isQuestion))
  throw new Error("既存の初期データ上書きが不正です。");

const updates = pack.updates.map((item, index) => {
  if (!isObject(item) || !isNonBlank(item.questionId, 200) || !isQuestion(item.question))
    throw new Error(`${index + 1}件目の更新が不正です。`);
  if (item.questionId !== item.question.id)
    throw new Error(`${item.questionId} の問題IDが一致しません。`);
  if (!baseIds.has(item.questionId))
    throw new Error(`${item.questionId} は初期問題に存在しません。`);
  return item.question;
});
if (new Set(updates.map((item) => item.id)).size !== updates.length)
  throw new Error("更新対象の問題IDが重複しています。");

const merged = new Map(existing.map((item) => [item.id, item]));
updates.forEach((item) => merged.set(item.id, item));
const sorted = [...merged.values()].sort((left, right) => left.id.localeCompare(right.id));
const output = `import type { Question } from "../types/Question";\n\n/**\n * 適用済み品質提案を今後の新規環境へ反映する初期データ上書き。\n * \`node tools/apply_question_seed_updates.mjs <seed-update-pack.json>\`で更新する。\n */\nexport const questionQualityOverrides: Question[] = ${JSON.stringify(sorted, null, 2)};\n`;
await writeFile(temporaryPath, output, "utf8");
await rename(temporaryPath, overridesPath);
console.log(`初期データ上書きを更新しました: ${updates.length}件（合計${sorted.length}件）`);
