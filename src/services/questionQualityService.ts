import type { Question, QuestionType } from "../types/Question";
import type {
  QuestionQualityProposal,
  QuestionQualityProposalInput,
  QuestionSeedUpdatePack,
} from "../types/QuestionQualityProposal";
import {
  answerDefinitionForExternalUse,
  questionTypeLabel,
  questionTypeOf,
} from "./questionAnswerModel.ts";
import { isQuestion, questionValidationErrors } from "./questionValidation.ts";

const APP_VERSION = "4.7.0";
const MAX_JSON_BYTES = 5 * 1024 * 1024;
const MAX_PROPOSALS = 10_000;
const MAX_TEXT = 20_000;
export const QUESTION_QUALITY_BATCH_SIZE_OPTIONS = [5, 8, 10, 15] as const;

export type QuestionQualitySourceFilter = "all" | "present" | "missing";
export type QuestionQualityReviewFocus =
  | "comprehensive"
  | "facts"
  | "distractors"
  | "explanation";

export interface QuestionQualitySelectionCriteria {
  categories: string[];
  difficulties: number[];
  questionTypes: QuestionType[];
  sourceFilter: QuestionQualitySourceFilter;
  searchText: string;
  excludePending: boolean;
  offset: number;
  limit: number;
}

export interface QuestionQualitySelectionPlan {
  activeCount: number;
  filterMatchedCount: number;
  pendingExcludedCount: number;
  matchedQuestions: Question[];
  pageQuestions: Question[];
  pageStart: number;
  pageEnd: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface QuestionQualityBatch {
  number: number;
  questions: Question[];
}

export interface QuestionQualityPromptOptions {
  focus?: QuestionQualityReviewFocus;
  batchNumber?: number;
  batchCount?: number;
  comparisonQuestions?: Question[];
  regenerationFeedback?: string;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isNonBlankString = (value: unknown, max = MAX_TEXT): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;
const isOptionalString = (
  value: unknown,
  max = MAX_TEXT,
): value is string | undefined =>
  value === undefined || (typeof value === "string" && value.length <= max);
const isTimestamp = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T/u.test(value) &&
  Number.isFinite(Date.parse(value));
const cloneQuestion = (question: Question): Question => structuredClone(question);
const sameQuestion = (left: Question, right: Question): boolean =>
  JSON.stringify(left) === JSON.stringify(right);
const normalizedSearch = (value: string): string =>
  value.normalize("NFKC").trim().toLocaleLowerCase();
const containsSearch = (question: Question, search: string): boolean => {
  if (!search) return true;
  return [
    question.id,
    question.category,
    question.subcategory ?? "",
    question.text,
    question.explanation,
    question.source ?? "",
    ...(question.tags ?? []),
  ].some((value) => normalizedSearch(value).includes(search));
};

const parseJson = (text: string): unknown => {
  if (new Blob([text]).size > MAX_JSON_BYTES)
    throw new Error("JSONファイルは5MB以下にしてください。");
  const trimmed = text.trim();
  const source = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?\s*/iu, "").replace(/\s*```$/u, "")
    : trimmed;
  try {
    return JSON.parse(source) as unknown;
  } catch {
    throw new Error("JSONを読み取れません。");
  }
};

export const createQualityInput = (questions: Question[]) => ({
  format: "study-quiz-question-quality-input" as const,
  version: 1 as const,
  exportedAt: new Date().toISOString(),
  questions: questions.map((question) => ({
    id: question.id,
    examScopeId: question.examScopeId,
    category: question.category,
    subcategory: question.subcategory,
    question: question.text,
    questionType: questionTypeOf(question),
    choices: question.choices,
    answer: answerDefinitionForExternalUse(question),
    explanation: question.explanation,
    source: question.source,
    tags: question.tags,
    weight: question.weight,
    difficulty: question.difficulty,
  })),
});

export const planQuestionQualitySelection = (
  questions: Question[],
  criteria: QuestionQualitySelectionCriteria,
  pendingQuestionIds: ReadonlySet<string> = new Set<string>(),
): QuestionQualitySelectionPlan => {
  const categories = new Set(criteria.categories);
  const difficulties = new Set(criteria.difficulties);
  const questionTypes = new Set(criteria.questionTypes);
  const search = normalizedSearch(criteria.searchText);
  const active = questions.filter((question) => !question.archivedAt);
  const filterMatched = active.filter((question) => {
    const hasSource = Boolean(question.source?.trim());
    return (
      categories.has(question.category) &&
      difficulties.has(question.difficulty) &&
      questionTypes.has(questionTypeOf(question)) &&
      (criteria.sourceFilter === "all" ||
        (criteria.sourceFilter === "present" ? hasSource : !hasSource)) &&
      containsSearch(question, search)
    );
  });
  const matchedQuestions = criteria.excludePending
    ? filterMatched.filter((question) => !pendingQuestionIds.has(question.id))
    : filterMatched;
  const pendingExcludedCount = filterMatched.length - matchedQuestions.length;
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(criteria.limit) || 1));
  const maxOffset =
    matchedQuestions.length === 0
      ? 0
      : Math.floor((matchedQuestions.length - 1) / safeLimit) * safeLimit;
  const pageStart = Math.min(Math.max(0, Math.trunc(criteria.offset) || 0), maxOffset);
  const pageQuestions = matchedQuestions.slice(pageStart, pageStart + safeLimit);
  return {
    activeCount: active.length,
    filterMatchedCount: filterMatched.length,
    pendingExcludedCount,
    matchedQuestions,
    pageQuestions,
    pageStart,
    pageEnd: pageStart + pageQuestions.length,
    hasPreviousPage: pageStart > 0,
    hasNextPage: pageStart + safeLimit < matchedQuestions.length,
  };
};

export const createQuestionQualityBatches = (
  questions: Question[],
  batchSize: number,
): QuestionQualityBatch[] => {
  const safeSize = Math.max(1, Math.min(15, Math.trunc(batchSize) || 1));
  const batches: QuestionQualityBatch[] = [];
  for (let index = 0; index < questions.length; index += safeSize) {
    batches.push({
      number: batches.length + 1,
      questions: questions.slice(index, index + safeSize),
    });
  }
  return batches;
};

const focusInstruction = (focus: QuestionQualityReviewFocus): string => {
  if (focus === "facts")
    return "最優先は事実、正答、コマンド・仕様・版条件、根拠の検証です。一次情報で確認できない変更は提案しないでください。";
  if (focus === "distractors")
    return "最優先は誤答選択肢の品質です。もっともらしいが設問条件では明確に誤りで、粒度・文法・長さが正答と揃う選択肢にしてください。";
  if (focus === "explanation")
    return "最優先は解説品質です。正答理由だけでなく、各誤答が不適切な理由、成立条件、注意点を簡潔に説明してください。";
  return "事実、正答、設問文、回答定義、誤答選択肢、解説、根拠、難易度、重複を総合的に確認してください。";
};

const duplicateContext = (questions: Question[]): string =>
  questions.length === 0
    ? "（比較対象なし）"
    : questions
        .slice(0, 100)
        .map(
          (question) =>
            `${question.id}\t${question.category}\t${question.subcategory ?? "-"}\t${question.text}`,
        )
        .join("\n");

export const buildQuestionQualityPrompt = (
  questions: Question[],
  options: QuestionQualityPromptOptions = {},
): string => {
  const input = createQualityInput(questions);
  const focus = options.focus ?? "comprehensive";
  const comparisonQuestions = options.comparisonQuestions ?? questions;
  const batchLabel =
    options.batchNumber && options.batchCount
      ? `この入力は全${options.batchCount}分割中の${options.batchNumber}番目です。`
      : "この入力を1つの品質レビュー単位として扱ってください。";
  const regeneration = options.regenerationFeedback?.trim()
    ? `\n再生成条件:\n${options.regenerationFeedback.trim()}\n前回案をそのまま繰り返さず、条件を満たす別案だけを出してください。\n`
    : "";
  return `あなたは資格試験・技術研修向けのシニア問題作成者兼ファクトチェッカーです。以下の既存問題を、学習目標を変えずに厳格にレビューしてください。新規問題を水増しせず、変更が本当に必要な問題だけ提案してください。\n\n処理単位:\n${batchLabel}\n1回の入力を小さく保ち、各問題を個別に検証してください。\n\n今回の重点:\n${focusInstruction(focus)}\n\n品質基準:\n1. 問題文: 単独で条件が分かり、曖昧な代名詞、不要な否定、正答を推測できる表現を避ける。否定問題は必要な場合だけ使い、否定語を明確にする。\n2. 正答: singleは唯一の最適解、multipleは正解集合の完全一致、textは表記揺れを考慮した許容回答であることを確認する。\n3. 誤答選択肢: 実在しない語の捏造や明らかな冗談を避け、学習者が陥りやすい誤解に基づくもっともらしい誤答にする。選択肢同士を排他的にし、文法・粒度・長さ・表現を揃える。\n4. 解説: 正答の根拠、各誤答が誤りである理由、成立条件・版差・例外・安全上の注意を、問題に必要な範囲で簡潔に説明する。問題文の言い換えだけにしない。\n5. 根拠・出典: 仕様、公式マニュアル、標準、一次資料を優先する。事実変更や正答変更には検証可能なreferenceを必須とし、確認できないURLや文献を捏造しない。不明なら変更を提案しない。\n6. 難易度: 1=用語・基本確認、3=条件判断・実務適用、5=複数条件・例外を含む高度判断として整合させる。単なる文章量で難易度を上げない。\n7. 重複回避: 下の比較対象と学習目標・正答・状況設定が実質的に重なる場合、表面的な言い換えを提案しない。重複自体が問題ならreasonへ明記する。\n8. 互換性: id、examScopeId、category、subcategory、archivedAtは変更しない。proposedには実際に変更するフィールドだけを含める。choicesを変える場合は0開始のanswerIndex/answerIndicesも必ず整合させる。\n9. 過剰修正防止: 好みだけの言い換え、根拠のない難化、情報を詰め込み過ぎる補足は行わない。品質が十分ならその問題の提案を出力しない。\n\n提案種別:\n- correction: 誤り、曖昧さ、正答不整合、誤答不備、解説の誤記を修正\n- supplement: 正しい内容を維持し、理解に必要な根拠・条件・注意点を追加\n${regeneration}\n出力前セルフチェック:\n- 正答定義と選択肢が一致しているか\n- singleに複数の妥当な答えが残っていないか\n- multipleの正解・誤答をすべて検証したか\n- textの許容回答が広すぎたり狭すぎたりしないか\n- 解説が正答と各誤答の理由を説明しているか\n- referenceが検証可能で、捏造されていないか\n- 比較対象との実質重複を増やしていないか\n\n出力は説明文やMarkdownを付けず、次のJSONオブジェクトだけにしてください。\n\n{"format":"study-quiz-question-quality-proposals","version":1,"proposals":[{"questionId":"ID","kind":"correction|supplement","summary":"変更点を一文で要約","reason":"品質基準に照らした具体的理由。正答・誤答・解説・重複の確認結果を含める","reference":"検証した一次情報名またはURL。事実・正答変更では必須","proposed":{"text":"修正後の問題文（任意）","questionType":"single|multiple|text（任意）","choices":["修正後の選択肢（任意）"],"answerIndex":0,"answerIndices":[0,2],"acceptedAnswers":["許容回答"],"explanation":"正答と各誤答の理由を含む解説（任意）","source":"問題データへ保存する出典（任意）","tags":["タグ（任意）"],"weight":1,"difficulty":1}}]}\n\n重複比較コンテキスト（参照専用。ここにある問題は入力JSONに含まれるもの以外は変更しない）:\n${duplicateContext(comparisonQuestions)}\n\n入力JSON:\n${JSON.stringify(input, null, 2)}`;
};

export const buildQuestionQualityRegenerationPrompt = (
  question: Question,
  proposal: QuestionQualityProposal,
): string =>
  buildQuestionQualityPrompt([question], {
    focus: "comprehensive",
    batchNumber: 1,
    batchCount: 1,
    comparisonQuestions: [question],
    regenerationFeedback: `前回提案は採用せず再検討します。\n前回要約: ${proposal.summary}\n前回理由: ${proposal.reason}\n前回参考情報: ${proposal.reference || "なし"}\n前回案の問題文: ${proposal.proposedQuestion.text}\n前回案の解説: ${proposal.proposedQuestion.explanation}\n現在の問題を基準に、前回案の弱点を解消してください。`,
  });

const proposalFromInput = (
  value: unknown,
  index: number,
  questionMap: ReadonlyMap<string, Question>,
  now: string,
): QuestionQualityProposal => {
  if (!isObject(value))
    throw new Error(`${index + 1}件目がオブジェクトではありません。`);
  const item = value as unknown as QuestionQualityProposalInput;
  if (!isNonBlankString(item.questionId, 200) || !questionMap.has(item.questionId))
    throw new Error(`${index + 1}件目の問題IDが存在しません。`);
  if (!("correction" === item.kind || "supplement" === item.kind))
    throw new Error(`${item.questionId} のkindが不正です。`);
  if (!isNonBlankString(item.summary) || !isNonBlankString(item.reason))
    throw new Error(`${item.questionId} のsummaryまたはreasonが不正です。`);
  if (!isOptionalString(item.reference))
    throw new Error(`${item.questionId} のreferenceが長すぎます。`);
  if (!isObject(item.proposed) || Object.keys(item.proposed).length === 0)
    throw new Error(`${item.questionId} のproposedが空です。`);
  const allowedProposedKeys = new Set([
    "text",
    "questionType",
    "choices",
    "answerIndex",
    "answerIndices",
    "acceptedAnswers",
    "explanation",
    "source",
    "tags",
    "weight",
    "difficulty",
  ]);
  const unknownKey = Object.keys(item.proposed).find(
    (key) => !allowedProposedKeys.has(key),
  );
  if (unknownKey)
    throw new Error(
      `${item.questionId} のproposedに未対応項目があります: ${unknownKey}`,
    );

  const beforeQuestion = cloneQuestion(questionMap.get(item.questionId) as Question);
  const proposedQuestion = {
    ...beforeQuestion,
    ...structuredClone(item.proposed),
    id: beforeQuestion.id,
    examScopeId: beforeQuestion.examScopeId,
    category: beforeQuestion.category,
  } satisfies Question;
  if (beforeQuestion.subcategory !== undefined)
    proposedQuestion.subcategory = beforeQuestion.subcategory;
  else delete proposedQuestion.subcategory;
  if (beforeQuestion.archivedAt !== undefined)
    proposedQuestion.archivedAt = beforeQuestion.archivedAt;
  else delete proposedQuestion.archivedAt;
  const errors = questionValidationErrors(proposedQuestion);
  if (errors.length > 0)
    throw new Error(
      `${item.questionId} の提案後データが不正です: ${errors.join(" / ")}`,
    );
  if (sameQuestion(beforeQuestion, proposedQuestion))
    throw new Error(`${item.questionId} の提案に実質的な変更がありません。`);

  return {
    id: crypto.randomUUID(),
    questionId: beforeQuestion.id,
    kind: item.kind,
    summary: item.summary.trim(),
    reason: item.reason.trim(),
    reference: item.reference?.trim() ?? "",
    beforeQuestion,
    proposedQuestion,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };
};

export const parseQuestionQualityProposals = (
  text: string,
  questions: Question[],
): QuestionQualityProposal[] => {
  const value = parseJson(text);
  if (
    !isObject(value) ||
    value.format !== "study-quiz-question-quality-proposals" ||
    value.version !== 1
  )
    throw new Error("対応していない品質提案JSONです。");
  if (!Array.isArray(value.proposals))
    throw new Error("proposalsは配列ではありません。");
  if (value.proposals.length > MAX_PROPOSALS)
    throw new Error("品質提案の件数が上限を超えています。");
  const questionMap = new Map(questions.map((question) => [question.id, question]));
  const now = new Date().toISOString();
  const proposals = value.proposals.map((item, index) =>
    proposalFromInput(item, index, questionMap, now),
  );
  if (new Set(proposals.map((item) => item.questionId)).size !== proposals.length)
    throw new Error("同じ問題IDの品質提案が重複しています。");
  return proposals;
};

export const isQuestionQualityProposal = (
  value: unknown,
): value is QuestionQualityProposal => {
  if (!isObject(value)) return false;
  return (
    isNonBlankString(value.id, 200) &&
    isNonBlankString(value.questionId, 200) &&
    ["correction", "supplement"].includes(String(value.kind)) &&
    isNonBlankString(value.summary) &&
    isNonBlankString(value.reason) &&
    typeof value.reference === "string" &&
    value.reference.length <= MAX_TEXT &&
    isQuestion(value.beforeQuestion) &&
    isQuestion(value.proposedQuestion) &&
    value.beforeQuestion.id === value.questionId &&
    value.proposedQuestion.id === value.questionId &&
    !sameQuestion(value.beforeQuestion, value.proposedQuestion) &&
    ["pending", "applied", "rejected"].includes(String(value.status)) &&
    isTimestamp(value.createdAt) &&
    isTimestamp(value.updatedAt) &&
    (value.reviewedAt === undefined || isTimestamp(value.reviewedAt)) &&
    (value.appliedAt === undefined || isTimestamp(value.appliedAt)) &&
    (value.status !== "applied" || isTimestamp(value.appliedAt))
  );
};

export const createQuestionSeedUpdatePack = (
  proposals: QuestionQualityProposal[],
): QuestionSeedUpdatePack => {
  const latestByQuestion = new Map<string, QuestionQualityProposal>();
  proposals
    .filter((item) => item.status === "applied" && item.appliedAt)
    .sort((left, right) =>
      String(left.appliedAt).localeCompare(String(right.appliedAt)),
    )
    .forEach((item) => latestByQuestion.set(item.questionId, item));
  return {
    format: "study-quiz-question-seed-updates",
    version: 1,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    updates: [...latestByQuestion.values()].map((item) => ({
      questionId: item.questionId,
      proposalId: item.id,
      appliedAt: item.appliedAt as string,
      beforeQuestion: cloneQuestion(item.beforeQuestion),
      question: cloneQuestion(item.proposedQuestion),
    })),
  };
};

export const questionQualityTypeLabel = (question: Question): string =>
  questionTypeLabel(question);
