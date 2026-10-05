import type { Question } from "../types/Question";

const MAX_TEXT_LENGTH = 20_000;
const MAX_SHORT_TEXT_LENGTH = 500;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const requiredText = (
  value: unknown,
  label: string,
  maxLength = MAX_TEXT_LENGTH,
): string => {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label}を入力してください。`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new Error(`${label}は${maxLength}文字以下にしてください。`);
  }
  return normalized;
};

const optionalText = (
  value: unknown,
  label: string,
  maxLength = MAX_TEXT_LENGTH,
): string | undefined => {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new Error(`${label}の形式が不正です。`);
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new Error(`${label}は${maxLength}文字以下にしてください。`);
  }
  return normalized || undefined;
};

const numberInRange = (
  value: unknown,
  label: string,
  minimum: number,
  maximum: number,
): number => {
  const numberValue = Number(value);
  if (
    !Number.isInteger(numberValue) ||
    numberValue < minimum ||
    numberValue > maximum
  ) {
    throw new Error(`${label}は${minimum}～${maximum}の整数にしてください。`);
  }
  return numberValue;
};

const stripCodeFence = (value: string): string => {
  const trimmed = value.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/iu);
  return match?.[1]?.trim() ?? trimmed;
};

const createUniqueId = (baseId: string, existingQuestions: Question[]): string => {
  const used = new Set(existingQuestions.map((item) => item.id));
  for (let sequence = 1; sequence <= 9999; sequence += 1) {
    const candidate = `${baseId}-SIM-${String(sequence).padStart(2, "0")}`;
    if (!used.has(candidate)) return candidate;
  }
  throw new Error("類似問題IDを採番できませんでした。");
};

export const buildSimilarQuestionPrompt = (baseQuestion: Question): string =>
  [
    "次の資格試験問題を基に、同じ知識を別の角度から確認する類似問題案を1件作成してください。",
    "元問題の単なる言い換えや正解位置だけの変更は避けてください。根拠が不明な内容は作らないでください。",
    "出力はMarkdownや説明文を付けず、次のキーを持つJSONオブジェクトだけにしてください。",
    '{"category":"","subcategory":"","text":"","choices":["",""],"answerNumber":1,"explanation":"","source":"","tags":[],"weight":1,"difficulty":1}',
    "answerNumberは1始まりです。choicesは2～8件、weightとdifficultyは1～5の整数にしてください。",
    "",
    `元問題ID: ${baseQuestion.id}`,
    `カテゴリ: ${baseQuestion.category}`,
    baseQuestion.subcategory
      ? `サブカテゴリ: ${baseQuestion.subcategory}`
      : "サブカテゴリ: なし",
    `問題文: ${baseQuestion.text}`,
    ...baseQuestion.choices.map(
      (choice, index) =>
        `選択肢${index + 1}${index === baseQuestion.answerIndex ? "（正解）" : ""}: ${choice}`,
    ),
    `解説: ${baseQuestion.explanation || "なし"}`,
    `出典: ${baseQuestion.source || "なし"}`,
    `タグ: ${(baseQuestion.tags ?? []).join(", ") || "なし"}`,
  ].join("\n");

export const validateSimilarQuestion = (
  candidate: Question,
  baseQuestion: Question,
  existingQuestions: Question[],
): Question => {
  const id = requiredText(candidate.id, "問題ID", 200);
  if (existingQuestions.some((item) => item.id === id)) {
    throw new Error(`問題ID ${id} は既に使用されています。`);
  }

  const category = requiredText(candidate.category, "カテゴリ", 200);
  const text = requiredText(candidate.text, "問題文");
  if (text === baseQuestion.text.trim()) {
    throw new Error("元問題と同一の問題文は登録できません。");
  }

  if (!Array.isArray(candidate.choices)) {
    throw new Error("選択肢の形式が不正です。");
  }
  const choices = candidate.choices.map((choice, index) =>
    requiredText(choice, `選択肢${index + 1}`, 10_000),
  );
  if (choices.length < 2 || choices.length > 8) {
    throw new Error("選択肢は2～8件にしてください。");
  }
  if (new Set(choices).size !== choices.length) {
    throw new Error("同一内容の選択肢は登録できません。");
  }

  const answerIndex = numberInRange(
    candidate.answerIndex,
    "正解位置",
    0,
    choices.length - 1,
  );
  const explanation = requiredText(candidate.explanation, "解説");
  const weight = numberInRange(candidate.weight, "重要度", 1, 5);
  const difficulty = numberInRange(candidate.difficulty, "難易度", 1, 5);
  const subcategory = optionalText(
    candidate.subcategory,
    "サブカテゴリ",
    MAX_SHORT_TEXT_LENGTH,
  );
  const source = optionalText(candidate.source, "出典", 2_000);

  const tags = (candidate.tags ?? []).map((tag, index) =>
    requiredText(tag, `タグ${index + 1}`, 200),
  );
  if (tags.length > 30) throw new Error("タグは30件以下にしてください。");

  return {
    id,
    category,
    ...(subcategory ? { subcategory } : {}),
    text,
    choices,
    answerIndex,
    explanation,
    ...(source ? { source } : {}),
    tags: [...new Set(tags)],
    weight,
    difficulty,
  };
};

export const parseSimilarQuestionDraft = (
  jsonText: string,
  baseQuestion: Question,
  existingQuestions: Question[],
): Question => {
  let value: unknown;
  try {
    value = JSON.parse(stripCodeFence(jsonText));
  } catch {
    throw new Error("類似問題案をJSONとして読み取れません。");
  }
  if (!isRecord(value)) throw new Error("JSONオブジェクトを貼り付けてください。");

  if (!Array.isArray(value.choices)) {
    throw new Error("choicesは配列で指定してください。");
  }
  const answerNumber = numberInRange(
    value.answerNumber,
    "answerNumber",
    1,
    value.choices.length,
  );
  const rawTags = value.tags ?? [];
  if (!Array.isArray(rawTags) || !rawTags.every((tag) => typeof tag === "string")) {
    throw new Error("tagsは文字列配列で指定してください。");
  }

  return validateSimilarQuestion(
    {
      id: createUniqueId(baseQuestion.id, existingQuestions),
      category: requiredText(value.category, "カテゴリ", 200),
      subcategory: optionalText(
        value.subcategory,
        "サブカテゴリ",
        MAX_SHORT_TEXT_LENGTH,
      ),
      text: requiredText(value.text, "問題文"),
      choices: value.choices as string[],
      answerIndex: answerNumber - 1,
      explanation: requiredText(value.explanation, "解説"),
      source: optionalText(value.source, "出典", 2_000),
      tags: rawTags as string[],
      weight: numberInRange(value.weight, "重要度", 1, 5),
      difficulty: numberInRange(value.difficulty, "難易度", 1, 5),
    },
    baseQuestion,
    existingQuestions,
  );
};
