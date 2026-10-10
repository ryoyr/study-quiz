import { questions as bundledQuestions } from "../data/questions";
import type { Question } from "../types/Question";
import type {
  QuestionMasterDataset,
  QuestionMasterDatasetDescriptor,
  QuestionMasterManifest,
  QuestionMasterMergePlan,
  QuestionMasterSnapshot,
  QuestionMasterSyncState,
} from "../types/QuestionMaster";
import { isQuestion } from "./questionValidation";
import { STORAGE_KEYS } from "./storageKeyRegistry";

const CONTENT_STATE_LIMIT = 100_000;
const DATASET_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/u;
const CONTENT_VERSION_PATTERN = /^\d{4}\.\d{2}\.\d{2}\.\d+$/u;
const SAFE_DATASET_PATH_PATTERN = /^questions\/[a-z0-9][a-z0-9-]{0,63}\.json$/u;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isPositiveInteger = (value: unknown): value is number =>
  Number.isInteger(value) && Number(value) > 0;

const isDatasetDescriptor = (
  value: unknown,
): value is QuestionMasterDatasetDescriptor =>
  isRecord(value) &&
  typeof value.id === "string" &&
  DATASET_ID_PATTERN.test(value.id) &&
  isPositiveInteger(value.version) &&
  typeof value.path === "string" &&
  SAFE_DATASET_PATH_PATTERN.test(value.path) &&
  isPositiveInteger(value.questionCount);

export const parseQuestionMasterManifest = (
  value: unknown,
): QuestionMasterManifest => {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    typeof value.contentVersion !== "string" ||
    !CONTENT_VERSION_PATTERN.test(value.contentVersion) ||
    typeof value.updatedAt !== "string" ||
    !Number.isFinite(Date.parse(value.updatedAt)) ||
    !Array.isArray(value.datasets) ||
    value.datasets.length === 0 ||
    value.datasets.length > 100 ||
    !value.datasets.every(isDatasetDescriptor)
  ) {
    throw new Error("問題マスターのマニフェスト形式が不正です。");
  }
  const ids = value.datasets.map((dataset) => dataset.id);
  const paths = value.datasets.map((dataset) => dataset.path);
  if (new Set(ids).size !== ids.length || new Set(paths).size !== paths.length) {
    throw new Error("問題マスターのデータセットIDまたはパスが重複しています。");
  }
  return value as unknown as QuestionMasterManifest;
};

export const parseQuestionMasterDataset = (
  value: unknown,
  descriptor: QuestionMasterDatasetDescriptor,
): QuestionMasterDataset => {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    value.datasetId !== descriptor.id ||
    value.version !== descriptor.version ||
    !Array.isArray(value.questions) ||
    value.questions.length !== descriptor.questionCount ||
    value.questions.length > CONTENT_STATE_LIMIT ||
    !value.questions.every(isQuestion)
  ) {
    throw new Error(`問題マスター ${descriptor.id} の形式が不正です。`);
  }
  const ids = value.questions.map((question) => (question as Question).id);
  if (new Set(ids).size !== ids.length) {
    throw new Error(`問題マスター ${descriptor.id} に重複した問題IDがあります。`);
  }
  return value as unknown as QuestionMasterDataset;
};

const readJsonResponse = async (response: Response, label: string): Promise<unknown> => {
  if (!response.ok) {
    throw new Error(`${label}を取得できませんでした（HTTP ${response.status}）。`);
  }
  try {
    return await response.json();
  } catch {
    throw new Error(`${label}をJSONとして読み込めませんでした。`);
  }
};

export const defaultQuestionMasterRootUrl = (): URL => {
  if (typeof document === "undefined") {
    throw new Error("問題マスターのURLを解決できない環境です。");
  }
  return new URL("content/", document.baseURI);
};

export const fetchQuestionMaster = async (
  fetcher: typeof fetch = fetch,
  rootUrl: URL = defaultQuestionMasterRootUrl(),
): Promise<QuestionMasterSnapshot> => {
  const manifestUrl = new URL("manifest.json", rootUrl);
  const manifest = parseQuestionMasterManifest(
    await readJsonResponse(
      await fetcher(manifestUrl, { cache: "no-cache" }),
      "問題マスターのマニフェスト",
    ),
  );
  const datasets = await Promise.all(
    manifest.datasets.map(async (descriptor) =>
      parseQuestionMasterDataset(
        await readJsonResponse(
          await fetcher(new URL(descriptor.path, rootUrl), { cache: "no-cache" }),
          `問題マスター ${descriptor.id}`,
        ),
        descriptor,
      ),
    ),
  );
  const questions = datasets.flatMap((dataset) => dataset.questions);
  if (new Set(questions.map((question) => question.id)).size !== questions.length) {
    throw new Error("複数データセット間で問題IDが重複しています。");
  }
  return { manifest, datasets, questions };
};

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort((left, right) => left.localeCompare(right))
      .map((key) => [key, stableValue(value[key])]),
  );
};

export const stableJson = (value: unknown): string =>
  JSON.stringify(stableValue(value));

export const questionFingerprint = (question: Question): string => {
  const text = stableJson(question);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

export const fingerprintQuestions = (
  questions: Question[],
): Record<string, string> =>
  Object.fromEntries(
    questions.map((question) => [question.id, questionFingerprint(question)]),
  );

const isSyncState = (value: unknown): value is QuestionMasterSyncState => {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    typeof value.contentVersion !== "string" ||
    !CONTENT_VERSION_PATTERN.test(value.contentVersion) ||
    typeof value.checkedAt !== "string" ||
    !Number.isFinite(Date.parse(value.checkedAt)) ||
    !isRecord(value.datasetVersions) ||
    !Object.values(value.datasetVersions).every(isPositiveInteger) ||
    !isRecord(value.questionFingerprints) ||
    Object.keys(value.questionFingerprints).length > CONTENT_STATE_LIMIT ||
    !Object.values(value.questionFingerprints).every(
      (fingerprint) =>
        typeof fingerprint === "string" && /^[0-9a-f]{8}$/u.test(fingerprint),
    )
  ) {
    return false;
  }
  return true;
};

export const loadQuestionMasterSyncState = (): QuestionMasterSyncState | null => {
  const raw = localStorage.getItem(STORAGE_KEYS.questionMasterState);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isSyncState(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const saveQuestionMasterSyncState = (
  state: QuestionMasterSyncState,
): void => {
  if (!isSyncState(state)) {
    throw new Error("問題マスター同期状態の形式が不正です。");
  }
  localStorage.setItem(STORAGE_KEYS.questionMasterState, JSON.stringify(state));
};

const createNextState = (
  snapshot: QuestionMasterSnapshot,
  checkedAt: string,
  previous: QuestionMasterSyncState | null,
): QuestionMasterSyncState => ({
  schemaVersion: 1,
  contentVersion: snapshot.manifest.contentVersion,
  datasetVersions: Object.fromEntries(
    snapshot.datasets.map((dataset) => [dataset.datasetId, dataset.version]),
  ),
  questionFingerprints: fingerprintQuestions(snapshot.questions),
  checkedAt,
  ...(previous?.lastPullRequest
    ? { lastPullRequest: previous.lastPullRequest }
    : {}),
});

/**
 * 直前の配布元フィンガープリントを基準に、安全に適用できる変更だけを計画する。
 * 初回は同梱問題を基準とするため、既存利用者の端末編集を配布元データで上書きしない。
 */
export const planQuestionMasterMerge = (
  localQuestions: Question[],
  snapshot: QuestionMasterSnapshot,
  previousState: QuestionMasterSyncState | null,
  checkedAt = new Date().toISOString(),
): QuestionMasterMergePlan => {
  const localById = new Map(localQuestions.map((question) => [question.id, question]));
  const remoteById = new Map(snapshot.questions.map((question) => [question.id, question]));
  const previousFingerprints =
    previousState?.questionFingerprints ?? fingerprintQuestions(bundledQuestions);
  const actions: QuestionMasterMergePlan["actions"] = [];
  const conflicts: QuestionMasterMergePlan["conflicts"] = [];
  let unchangedCount = 0;

  for (const remote of snapshot.questions) {
    const local = localById.get(remote.id);
    if (!local) {
      actions.push({ kind: "add", questionId: remote.id, after: remote });
      continue;
    }
    const localFingerprint = questionFingerprint(local);
    const remoteFingerprint = questionFingerprint(remote);
    const previousFingerprint = previousFingerprints[remote.id];
    if (localFingerprint === remoteFingerprint) {
      unchangedCount += 1;
      continue;
    }
    if (previousFingerprint && localFingerprint === previousFingerprint) {
      actions.push({
        kind: "update",
        questionId: remote.id,
        before: local,
        after: remote,
      });
      continue;
    }
    if (previousFingerprint === remoteFingerprint) {
      unchangedCount += 1;
      continue;
    }
    conflicts.push({
      questionId: remote.id,
      reason: previousFingerprint
        ? "LOCAL_AND_REMOTE_CHANGED"
        : "UNTRACKED_ID_COLLISION",
      local,
      remote,
    });
  }

  for (const local of localQuestions) {
    if (remoteById.has(local.id)) continue;
    const previousFingerprint = previousFingerprints[local.id];
    if (!previousFingerprint) {
      unchangedCount += 1;
      continue;
    }
    if (questionFingerprint(local) !== previousFingerprint) {
      conflicts.push({
        questionId: local.id,
        reason: "LOCAL_CHANGED_REMOTE_REMOVED",
        local,
      });
      continue;
    }
    if (local.archivedAt) {
      unchangedCount += 1;
      continue;
    }
    actions.push({
      kind: "archive",
      questionId: local.id,
      before: local,
      after: { ...local, archivedAt: snapshot.manifest.updatedAt },
    });
  }

  return {
    actions,
    conflicts,
    unchangedCount,
    nextState: createNextState(snapshot, checkedAt, previousState),
  };
};

export const applyQuestionMasterMerge = (
  localQuestions: Question[],
  plan: QuestionMasterMergePlan,
): Question[] => {
  const actions = new Map(plan.actions.map((action) => [action.questionId, action]));
  const next = localQuestions.map(
    (question) => actions.get(question.id)?.after ?? question,
  );
  const existing = new Set(next.map((question) => question.id));
  for (const action of plan.actions) {
    if (action.kind === "add" && !existing.has(action.questionId)) {
      next.push(action.after);
      existing.add(action.questionId);
    }
  }
  return next;
};
