import type { Question } from "../types/Question";
import type {
  CreateContentPullRequestCommand,
  QuestionMasterChange,
  QuestionMasterSnapshot,
} from "../types/QuestionMaster";
import { isQuestion } from "./questionValidation";
import {
  questionFingerprint,
  stableJson,
} from "./questionMasterService";

const MAX_CHANGES = 5_000;
const TITLE_LIMIT = 200;
const BODY_LIMIT = 20_000;
const COMMIT_MESSAGE_LIMIT = 500;

const questionFields = (before: Question, after: Question): string[] => {
  const left = before as unknown as Record<string, unknown>;
  const right = after as unknown as Record<string, unknown>;
  return [...new Set([...Object.keys(left), ...Object.keys(right)])]
    .filter((key) => stableJson(left[key]) !== stableJson(right[key]))
    .sort((a, b) => a.localeCompare(b));
};

const datasetIndex = (
  snapshot: QuestionMasterSnapshot,
): Map<string, string> =>
  new Map(
    snapshot.datasets.flatMap((dataset) =>
      dataset.questions.map((question) => [question.id, dataset.datasetId] as const),
    ),
  );

export const buildQuestionMasterChanges = (
  snapshot: QuestionMasterSnapshot,
  localQuestions: Question[],
): QuestionMasterChange[] => {
  if (snapshot.datasets.length === 0) {
    throw new Error("送信先の問題データセットがありません。");
  }
  if (localQuestions.length > 100_000 || !localQuestions.every(isQuestion)) {
    throw new Error("端末内の問題データ形式が不正です。");
  }
  if (new Set(localQuestions.map((question) => question.id)).size !== localQuestions.length) {
    throw new Error("端末内の問題IDが重複しています。");
  }

  const masterById = new Map(snapshot.questions.map((question) => [question.id, question]));
  const datasetByQuestion = datasetIndex(snapshot);
  const fallbackDatasetId = snapshot.datasets[0].datasetId;
  const changes: QuestionMasterChange[] = [];

  for (const local of localQuestions) {
    const before = masterById.get(local.id);
    if (!before) {
      changes.push({
        datasetId: fallbackDatasetId,
        operation: "add",
        questionId: local.id,
        changedFields: Object.keys(local).sort((a, b) => a.localeCompare(b)),
        after: local,
      });
      continue;
    }
    const changedFields = questionFields(before, local);
    if (changedFields.length === 0) continue;
    changes.push({
      datasetId: datasetByQuestion.get(local.id) ?? fallbackDatasetId,
      operation:
        before.archivedAt === undefined && local.archivedAt !== undefined
          ? "archive"
          : "update",
      questionId: local.id,
      baseFingerprint: questionFingerprint(before),
      changedFields,
      before,
      after: local,
    });
  }

  if (changes.length > MAX_CHANGES) {
    throw new Error(`一度に送信できる変更は${MAX_CHANGES.toLocaleString()}件までです。`);
  }
  return changes.sort((left, right) => left.questionId.localeCompare(right.questionId));
};

const requireText = (value: string, label: string, maxLength: number): string => {
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new Error(`${label}は1～${maxLength.toLocaleString()}文字で指定してください。`);
  }
  return normalized;
};

const sha256 = async (value: string): Promise<string> => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

export const createContentPullRequestCommand = async (
  snapshot: QuestionMasterSnapshot,
  changes: QuestionMasterChange[],
  values: { title: string; body: string; commitMessage: string },
): Promise<CreateContentPullRequestCommand> => {
  if (changes.length === 0) throw new Error("GitHubへ送信する変更がありません。");
  if (changes.length > MAX_CHANGES) {
    throw new Error(`一度に送信できる変更は${MAX_CHANGES.toLocaleString()}件までです。`);
  }
  const title = requireText(values.title, "Pull Requestタイトル", TITLE_LIMIT);
  const body = requireText(values.body, "Pull Request説明", BODY_LIMIT);
  const commitMessage = requireText(
    values.commitMessage,
    "コミットメッセージ",
    COMMIT_MESSAGE_LIMIT,
  );
  const unsigned = {
    schemaVersion: 1 as const,
    baseContentVersion: snapshot.manifest.contentVersion,
    baseDatasetVersions: Object.fromEntries(
      snapshot.datasets.map((dataset) => [dataset.datasetId, dataset.version]),
    ),
    changes,
    title,
    body,
    commitMessage,
  };
  const idempotencyKey = await sha256(stableJson(unsigned));
  return { ...unsigned, idempotencyKey };
};
