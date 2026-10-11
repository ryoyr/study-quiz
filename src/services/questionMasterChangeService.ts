import type { Question } from "../types/Question";
import type {
  ApplyD1ChangesCommand,
  QuestionMasterChange,
  QuestionMasterSnapshot,
} from "../types/QuestionMaster";
import { isQuestion } from "./questionValidation";
import { questionFingerprint, stableJson } from "./questionMasterService";

const MAX_CHANGES = 5_000;
const MESSAGE_LIMIT = 2_000;

export const distributionOf = (question: Question): "shared" | "local-only" =>
  question.distribution ?? "shared";

export const withoutDistribution = (question: Question): Question => {
  const { distribution: _distribution, ...shared } = question;
  return shared;
};

const questionFields = (before: Question, after: Question): string[] => {
  const left = withoutDistribution(before) as unknown as Record<string, unknown>;
  const right = withoutDistribution(after) as unknown as Record<string, unknown>;
  return [...new Set([...Object.keys(left), ...Object.keys(right)])]
    .filter((key) => stableJson(left[key]) !== stableJson(right[key]))
    .sort((a, b) => a.localeCompare(b));
};

const datasetIndex = (snapshot: QuestionMasterSnapshot): Map<string, string> =>
  new Map(
    snapshot.datasets.flatMap((dataset) =>
      dataset.questions.map((question) => [question.id, dataset.datasetId] as const),
    ),
  );

export const countLocalOnlyQuestions = (questions: Question[]): number =>
  questions.filter((question) => distributionOf(question) === "local-only").length;

/** local-onlyはこの境界で必ず除外し、D1へ送るQuestionからdistribution自体も外す。 */
export const buildQuestionMasterChanges = (
  snapshot: QuestionMasterSnapshot,
  localQuestions: Question[],
): QuestionMasterChange[] => {
  if (snapshot.datasets.length === 0) throw new Error("D1の送信先データセットがありません。");
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
    if (distributionOf(local) === "local-only") continue;
    const sharedLocal = withoutDistribution(local);
    const before = masterById.get(local.id);
    if (!before) {
      changes.push({
        datasetId: fallbackDatasetId,
        operation: "add",
        questionId: local.id,
        changedFields: Object.keys(sharedLocal).sort((a, b) => a.localeCompare(b)),
        after: sharedLocal,
      });
      continue;
    }
    const changedFields = questionFields(before, sharedLocal);
    if (changedFields.length === 0) continue;
    changes.push({
      datasetId: datasetByQuestion.get(local.id) ?? fallbackDatasetId,
      operation:
        before.archivedAt === undefined && sharedLocal.archivedAt !== undefined
          ? "archive"
          : "update",
      questionId: local.id,
      baseFingerprint: questionFingerprint(before),
      changedFields,
      before: withoutDistribution(before),
      after: sharedLocal,
    });
  }

  if (changes.length > MAX_CHANGES) {
    throw new Error(`一度にD1へ送信できる変更は${MAX_CHANGES.toLocaleString()}件までです。`);
  }
  return changes.sort((left, right) => left.questionId.localeCompare(right.questionId));
};

const sha256 = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

export const createApplyD1ChangesCommand = async (
  snapshot: QuestionMasterSnapshot,
  changes: QuestionMasterChange[],
  messageValue: string,
): Promise<ApplyD1ChangesCommand> => {
  if (changes.length === 0) throw new Error("D1へ反映する共有問題の変更がありません。");
  if (changes.length > MAX_CHANGES) throw new Error(`一度に送信できる変更は${MAX_CHANGES.toLocaleString()}件までです。`);
  if (changes.some((change) => distributionOf(change.after) === "local-only" || "distribution" in change.after)) {
    throw new Error("ローカル専用属性を含む問題はD1へ送信できません。");
  }
  const message = messageValue.trim();
  if (!message || message.length > MESSAGE_LIMIT) {
    throw new Error(`変更理由は1～${MESSAGE_LIMIT.toLocaleString()}文字で指定してください。`);
  }
  const unsigned = {
    schemaVersion: 1 as const,
    baseContentVersion: snapshot.manifest.contentVersion,
    baseDatasetVersions: Object.fromEntries(
      snapshot.datasets.map((dataset) => [dataset.datasetId, dataset.version]),
    ),
    changes,
    message,
  };
  return { ...unsigned, idempotencyKey: await sha256(stableJson(unsigned)) };
};
