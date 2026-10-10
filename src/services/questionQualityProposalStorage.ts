import type { Question } from "../types/Question";
import type {
  QuestionQualityProposal,
  QuestionQualityProposalStatus,
} from "../types/QuestionQualityProposal";
import { isQuestion } from "./questionValidation.ts";
import { isQuestionQualityProposal } from "./questionQualityService.ts";
import {
  QUESTION_SEED_VERSION,
  QUESTION_SEED_VERSION_KEY,
  QUESTIONS_STORAGE_KEY,
} from "./questionStorage.ts";
import { STORAGE_KEYS } from "./storageKeyRegistry.ts";
import { executeStorageTransaction } from "./storageTransaction.ts";
import { writeStorageValue } from "./verifiedStorage.ts";

const STORAGE_KEY = STORAGE_KEYS.questionQualityProposals;
const MAX_PROPOSALS = 10_000;

const validateProposals = (items: QuestionQualityProposal[]): void => {
  if (
    items.length > MAX_PROPOSALS ||
    !items.every(isQuestionQualityProposal) ||
    new Set(items.map((item) => item.id)).size !== items.length
  ) {
    throw new Error("問題・解説品質提案の形式が不正です。");
  }
};

export const loadQuestionQualityProposals = (): QuestionQualityProposal[] => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    const valid = parsed.filter(isQuestionQualityProposal);
    return [...new Map(valid.map((item) => [item.id, item])).values()];
  } catch {
    return [];
  }
};

export const saveQuestionQualityProposals = (
  items: QuestionQualityProposal[],
): void => {
  validateProposals(items);
  writeStorageValue(STORAGE_KEY, JSON.stringify(items));
};

export const addQuestionQualityProposals = (
  current: QuestionQualityProposal[],
  additions: QuestionQualityProposal[],
): QuestionQualityProposal[] => {
  validateProposals(additions);
  const pendingQuestionIds = new Set(
    current
      .filter((item) => item.status === "pending")
      .map((item) => item.questionId),
  );
  const duplicate = additions.find((item) => pendingQuestionIds.has(item.questionId));
  if (duplicate)
    throw new Error(
      `${duplicate.questionId} には未確認の品質提案があります。先にレビューしてください。`,
    );
  const next = [...additions, ...current];
  validateProposals(next);
  return next;
};

export const reviewQuestionQualityProposal = (
  items: QuestionQualityProposal[],
  id: string,
  status: Exclude<QuestionQualityProposalStatus, "applied">,
): QuestionQualityProposal[] => {
  const now = new Date().toISOString();
  const next = items.map((item) =>
    item.id === id && item.status !== "applied"
      ? { ...item, status, reviewedAt: now, updatedAt: now }
      : item,
  );
  validateProposals(next);
  return next;
};

export interface AppliedQuestionQualityProposalResult {
  questions: Question[];
  proposals: QuestionQualityProposal[];
}

export const applyQuestionQualityProposal = (
  questions: Question[],
  proposals: QuestionQualityProposal[],
  proposalId: string,
): AppliedQuestionQualityProposalResult => {
  if (
    questions.length > 100_000 ||
    !questions.every(isQuestion) ||
    new Set(questions.map((item) => item.id)).size !== questions.length
  )
    throw new Error("現在の問題データが不正です。");
  validateProposals(proposals);
  const proposal = proposals.find((item) => item.id === proposalId);
  if (!proposal) throw new Error("品質提案が見つかりません。");
  if (proposal.status !== "pending")
    throw new Error("未確認の品質提案だけを適用できます。");
  const current = questions.find((item) => item.id === proposal.questionId);
  if (!current) throw new Error("対象問題が見つかりません。");
  if (JSON.stringify(current) !== JSON.stringify(proposal.beforeQuestion))
    throw new Error(
      "提案作成後に問題が変更されています。現在の問題で品質提案を作り直してください。",
    );

  const nextQuestion = structuredClone(proposal.proposedQuestion);
  if (!isQuestion(nextQuestion) || nextQuestion.id !== current.id)
    throw new Error("提案後の問題データが不正です。");
  const questionsNext = questions.map((item) =>
    item.id === current.id ? nextQuestion : item,
  );
  const now = new Date().toISOString();
  const proposalsNext = proposals.map((item) =>
    item.id === proposalId
      ? {
          ...item,
          status: "applied" as const,
          reviewedAt: now,
          appliedAt: now,
          updatedAt: now,
        }
      : item,
  );
  validateProposals(proposalsNext);

  executeStorageTransaction([
    { key: QUESTIONS_STORAGE_KEY, value: JSON.stringify(questionsNext) },
    { key: QUESTION_SEED_VERSION_KEY, value: QUESTION_SEED_VERSION },
    { key: STORAGE_KEY, value: JSON.stringify(proposalsNext) },
  ]);
  return { questions: questionsNext, proposals: proposalsNext };
};
