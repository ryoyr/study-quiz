#!/usr/bin/env node
import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packPath = process.argv[2] ? resolve(process.cwd(), process.argv[2]) : "";
const questionsPath = resolve(root, "src/data/questions.ts");
const outputPath = resolve(root, "src/data/questionQualityOverrides.ts");

const fail = (message) => { throw new Error(message); };
const validateQuestion = (question) => {
  const errors = [];
  if (!question || typeof question !== "object" || Array.isArray(question)) return ["問題データがオブジェクトではありません"];
  if (typeof question.id !== "string" || !question.id.trim()) errors.push("問題IDは必須です");
  if (typeof question.examScopeId !== "string" || !question.examScopeId.trim()) errors.push("試験枠IDは必須です");
  if (typeof question.category !== "string" || !question.category.trim()) errors.push("カテゴリは必須です");
  if (typeof question.text !== "string" || !question.text.trim()) errors.push("問題文は必須です");
  const type = question.questionType ?? "single";
  if (type === "text") {
    if (!Array.isArray(question.choices) || question.choices.length !== 0) errors.push("入力問題の選択肢は空です");
    if (!Array.isArray(question.acceptedAnswers) || question.acceptedAnswers.length === 0) errors.push("許容回答が必要です");
  } else {
    if (!Array.isArray(question.choices) || question.choices.length < 2 || question.choices.length > 8) errors.push("選択肢は2～8件です");
    if (Array.isArray(question.choices) && new Set(question.choices).size !== question.choices.length) errors.push("同一内容の選択肢は重複できません");
    if (!Number.isInteger(question.answerIndex) || question.answerIndex < 0 || question.answerIndex >= (question.choices?.length ?? 0)) errors.push("正解の選択肢指定が不正です");
    if (type === "multiple" && (!Array.isArray(question.answerIndices) || question.answerIndices.length === 0 || new Set(question.answerIndices).size !== question.answerIndices.length)) errors.push("複数正解指定が不正です");
  }
  if (typeof question.explanation !== "string") errors.push("解説が不正です");
  if (typeof question.weight !== "number" || !Number.isFinite(question.weight) || question.weight <= 0) errors.push("出題ウェイトは0より大きい数値です");
  if (!Number.isInteger(question.difficulty) || question.difficulty < 1 || question.difficulty > 5) errors.push("難易度は1～5です");
  if (question.distribution !== undefined && !["shared", "local-only"].includes(question.distribution)) errors.push("公開範囲が不正です");
  return errors;
};

const parseOverrides = (source) => {
  const match = source.match(/export\s+const\s+questionQualityOverrides\s*:[^=]+?=\s*(\[[\s\S]*\])\s*;\s*$/u);
  if (!match) fail("既存の初期問題上書きファイルを解析できません");
  return JSON.parse(match[1]);
};

try {
  if (!packPath) fail("seed update packのパスを指定してください");
  const pack = JSON.parse(await readFile(packPath, "utf8"));
  if (pack?.format !== "study-quiz-question-seed-updates" || pack?.version !== 1 || !Array.isArray(pack.updates)) fail("seed update pack形式が不正です");
  const questionsSource = await readFile(questionsPath, "utf8");
  const ids = new Set([...questionsSource.matchAll(/\bq\(\s*["'`]([^"'`]+)["'`]/gu)].map((match) => match[1]));
  const seen = new Set();
  for (const item of pack.updates) {
    if (!item || typeof item !== "object" || typeof item.questionId !== "string") fail("更新項目の形式が不正です");
    if (seen.has(item.questionId)) fail(`更新対象 ${item.questionId} が重複しています`);
    seen.add(item.questionId);
    if (!ids.has(item.questionId)) fail(`初期問題 ${item.questionId} がquestions.tsに存在しません`);
    if (item.beforeQuestion?.id !== item.questionId) fail(`${item.questionId} の更新前問題IDが一致しません`);
    if (item.question?.id !== item.questionId) fail(`${item.questionId} の更新後問題IDが一致しません`);
    const errors = validateQuestion(item.question);
    if (errors.length) fail(`更新後問題形式が不正: ${errors.join(" / ")}`);
  }
  const existing = parseOverrides(await readFile(outputPath, "utf8"));
  const merged = new Map(existing.map((item) => [item.id, item]));
  for (const item of pack.updates) merged.set(item.questionId, item.question);
  const values = [...merged.values()].sort((left, right) => left.id.localeCompare(right.id));
  const output = `import type { Question } from "../types/Question";\n\nexport const questionQualityOverrides: Question[] = ${JSON.stringify(values, null, 2)};\n`;
  const temporary = `${outputPath}.tmp-${process.pid}-${Date.now()}`;
  try {
    await writeFile(temporary, output, "utf8");
    await rename(temporary, outputPath);
  } finally {
    await unlink(temporary).catch(() => undefined);
  }
  console.log(`${pack.updates.length}件を適用し、${values.length}件の初期問題上書きを出力しました。`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
