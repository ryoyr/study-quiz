import type { Question } from "../types/Question";
import {
  answerDefinitionForExternalUse,
  questionTypeOf,
} from "./questionAnswerModel";

export interface FactCheckFinding {
  questionId: string;
  status: "ok" | "needs_correction" | "uncertain";
  summary: string;
  suggestion: string;
  reason: string;
  reference: string;
}

export const buildBatchFactCheckPrompt = (questions: Question[]): string => {
  const payload = questions.map((question) => ({
    id: question.id,
    category: question.category,
    subcategory: question.subcategory,
    question: question.text,
    questionType: questionTypeOf(question),
    choices: question.choices,
    answer: answerDefinitionForExternalUse(question),
    explanation: question.explanation,
    source: question.source,
    tags: question.tags,
  }));
  return `以下の問題をファクトチェックしてください。回答方式はsingle（択一）、multiple（複数正解の完全一致）、text（正規化完全一致）です。各問題について、回答定義・解説・選択肢または許容回答の技術的正確性を確認し、推測せず、不明な場合は uncertain としてください。出力は説明文を付けず、次のJSON配列形式だけにしてください。\n\n[{"questionId":"ID","status":"ok|needs_correction|uncertain","summary":"確認結果","suggestion":"修正案。修正不要なら空文字","reason":"判断理由","reference":"確認に用いた一次情報名またはURL。不明なら空文字"}]\n\n対象問題:\n${JSON.stringify(payload, null, 2)}`;
};

export const parseFactCheckFindings = (
  text: string,
  questions: Question[],
): FactCheckFinding[] => {
  const parsed = JSON.parse(text) as unknown;
  if (!Array.isArray(parsed)) throw new Error("JSON配列ではありません。");
  const ids = new Set(questions.map((question) => question.id));
  const findings = parsed.map((value, index) => {
    if (typeof value !== "object" || value === null)
      throw new Error(`${index + 1}件目がオブジェクトではありません。`);
    const item = value as Partial<FactCheckFinding>;
    if (!item.questionId || !ids.has(item.questionId))
      throw new Error(`${index + 1}件目の問題IDが存在しません。`);
    if (!['ok', 'needs_correction', 'uncertain'].includes(item.status ?? ""))
      throw new Error(`${item.questionId} のstatusが不正です。`);
    return {
      questionId: item.questionId,
      status: item.status as FactCheckFinding["status"],
      summary: String(item.summary ?? ""),
      suggestion: String(item.suggestion ?? ""),
      reason: String(item.reason ?? ""),
      reference: String(item.reference ?? ""),
    };
  });
  if (new Set(findings.map((item) => item.questionId)).size !== findings.length)
    throw new Error("同じ問題IDの結果が重複しています。");
  return findings;
};
