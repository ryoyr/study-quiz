import { isQuestion } from "../../../src/services/questionValidation";
import type { Question } from "../../../src/types/Question";
import type {
  QuestionMasterDataset,
  QuestionMasterDatasetDescriptor,
  QuestionMasterManifest,
} from "../../../src/types/QuestionMaster";
import { GitHubApiError } from "./github";
import { ApiError } from "./http";
import type {
  GitHubPullRequest,
  GitHubRepositoryClient,
  PreparedMasterUpdate,
  PullRequestResult,
  RepositoryMaster,
  ValidatedCommand,
  WorkerEnv,
} from "./types";
import { stableJson } from "./validation";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const positiveInteger = (value: unknown): value is number =>
  Number.isInteger(value) && Number(value) > 0;
const datasetId = (value: unknown): value is string =>
  typeof value === "string" && /^[a-z0-9][a-z0-9-]{0,63}$/u.test(value);
const safeDatasetPath = (value: unknown): value is string =>
  typeof value === "string" && /^questions\/[a-z0-9][a-z0-9-]{0,63}\.json$/u.test(value);

const parseManifest = (value: unknown): QuestionMasterManifest => {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    typeof value.contentVersion !== "string" ||
    !/^\d{4}\.\d{2}\.\d{2}\.\d+$/u.test(value.contentVersion) ||
    typeof value.updatedAt !== "string" ||
    !Number.isFinite(Date.parse(value.updatedAt)) ||
    !Array.isArray(value.datasets) ||
    value.datasets.length === 0 ||
    value.datasets.length > 100
  ) {
    throw new ApiError(422, "INVALID_REPOSITORY_MANIFEST", "GitHub上のマニフェストが不正です。");
  }
  const descriptors = value.datasets as unknown[];
  if (
    !descriptors.every(
      (item) =>
        isRecord(item) &&
        datasetId(item.id) &&
        positiveInteger(item.version) &&
        safeDatasetPath(item.path) &&
        positiveInteger(item.questionCount),
    )
  ) {
    throw new ApiError(422, "INVALID_REPOSITORY_MANIFEST", "GitHub上のデータセット定義が不正です。");
  }
  const ids = descriptors.map((item) => (item as { id: string }).id);
  const paths = descriptors.map((item) => (item as { path: string }).path);
  if (new Set(ids).size !== ids.length || new Set(paths).size !== paths.length) {
    throw new ApiError(422, "INVALID_REPOSITORY_MANIFEST", "GitHub上のデータセット定義が重複しています。");
  }
  return value as unknown as QuestionMasterManifest;
};

const parseDataset = (
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
    value.questions.length > 100_000 ||
    !value.questions.every(isQuestion)
  ) {
    throw new ApiError(
      422,
      "INVALID_REPOSITORY_DATASET",
      `GitHub上の問題マスター ${descriptor.id} が不正です。`,
    );
  }
  const ids = (value.questions as Question[]).map((question) => question.id);
  if (new Set(ids).size !== ids.length) {
    throw new ApiError(422, "DUPLICATE_QUESTION_ID", `問題マスター ${descriptor.id} のIDが重複しています。`);
  }
  return value as unknown as QuestionMasterDataset;
};

const fingerprint = (question: Question): string => {
  const text = stableJson(question);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

const contentRoot = (env: WorkerEnv): string => {
  const value = env.GITHUB_CONTENT_ROOT.trim().replace(/\/$/u, "");
  if (!value || value.startsWith("/") || value.split("/").includes("..") || !/^[A-Za-z0-9._/-]+$/u.test(value)) {
    throw new ApiError(503, "CONTENT_ROOT_INVALID", "GITHUB_CONTENT_ROOTが不正です。");
  }
  return value;
};

export const readRepositoryMaster = async (
  github: GitHubRepositoryClient,
  env: WorkerEnv,
): Promise<RepositoryMaster> => {
  const head = await github.getBranchHead(env.GITHUB_BASE_BRANCH);
  const root = contentRoot(env);
  const manifest = parseManifest(
    await github.readJsonFile(`${root}/manifest.json`, head.commitSha),
  );
  const datasets = await Promise.all(
    manifest.datasets.map(async (descriptor) =>
      parseDataset(
        await github.readJsonFile(`${root}/${descriptor.path}`, head.commitSha),
        descriptor,
      ),
    ),
  );
  const allIds = datasets.flatMap((dataset) => dataset.questions.map((question) => question.id));
  if (new Set(allIds).size !== allIds.length) {
    throw new ApiError(422, "DUPLICATE_QUESTION_ID", "データセット間で問題IDが重複しています。");
  }
  return {
    baseCommitSha: head.commitSha,
    baseTreeSha: head.treeSha,
    manifest,
    datasets,
  };
};

const requireBaseVersion = (
  repository: RepositoryMaster,
  command: ValidatedCommand,
): void => {
  const actualVersions = Object.fromEntries(
    repository.datasets.map((dataset) => [dataset.datasetId, dataset.version]),
  );
  if (
    repository.manifest.contentVersion !== command.baseContentVersion ||
    stableJson(actualVersions) !== stableJson(command.baseDatasetVersions)
  ) {
    throw new ApiError(
      409,
      "CONTENT_VERSION_CONFLICT",
      "GitHub側の問題マスターが編集開始時点から更新されています。",
      "最新版を取得して競合内容を確認し、送信前確認からやり直してください。",
    );
  }
};

const nextContentVersion = (now: Date): string => {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${year}.${month}.${day}.${now.getTime()}`;
};

export const prepareMasterUpdate = (
  repository: RepositoryMaster,
  command: ValidatedCommand,
  now: Date,
): PreparedMasterUpdate => {
  requireBaseVersion(repository, command);
  const datasets = repository.datasets.map((dataset) => ({
    ...dataset,
    questions: dataset.questions.map((question) => ({ ...question })),
  }));
  const datasetById = new Map(datasets.map((dataset) => [dataset.datasetId, dataset]));
  const allQuestionIds = new Set(datasets.flatMap((dataset) => dataset.questions.map((question) => question.id)));
  const touchedDatasetIds = new Set<string>();

  for (const change of command.changes) {
    const dataset = datasetById.get(change.datasetId);
    if (!dataset) {
      throw new ApiError(400, "DATASET_NOT_ALLOWED", `データセット ${change.datasetId} は変更できません。`);
    }
    const index = dataset.questions.findIndex((question) => question.id === change.questionId);
    if (change.operation === "add") {
      if (index >= 0 || allQuestionIds.has(change.questionId)) {
        throw new ApiError(409, "QUESTION_ALREADY_EXISTS", `問題 ${change.questionId} は既に存在します。`);
      }
      dataset.questions.push(change.after);
      allQuestionIds.add(change.questionId);
    } else {
      if (index < 0) {
        throw new ApiError(409, "QUESTION_NOT_FOUND", `問題 ${change.questionId} はGitHub側に存在しません。`);
      }
      const current = dataset.questions[index];
      if (fingerprint(current) !== change.baseFingerprint) {
        throw new ApiError(
          409,
          "QUESTION_CONFLICT",
          `問題 ${change.questionId} はGitHub側で変更されています。`,
          "最新版を取得して問題単位の差分を確認してください。",
        );
      }
      dataset.questions[index] = change.after;
    }
    touchedDatasetIds.add(dataset.datasetId);
  }

  for (const dataset of datasets) {
    if (touchedDatasetIds.has(dataset.datasetId)) dataset.version += 1;
  }
  const updatedAt = now.toISOString();
  const manifest: QuestionMasterManifest = {
    ...repository.manifest,
    contentVersion: nextContentVersion(now),
    updatedAt,
    datasets: repository.manifest.datasets.map((descriptor) => {
      const dataset = datasetById.get(descriptor.id) as QuestionMasterDataset;
      return {
        ...descriptor,
        version: dataset.version,
        questionCount: dataset.questions.length,
      };
    }),
  };
  const descriptorById = new Map(manifest.datasets.map((descriptor) => [descriptor.id, descriptor]));
  const touchedPaths = [
    "manifest.json",
    ...[...touchedDatasetIds].map(
      (id) => (descriptorById.get(id) as QuestionMasterDatasetDescriptor).path,
    ),
  ];
  return { manifest, datasets, touchedPaths };
};

const branchName = (command: ValidatedCommand): string => {
  const [year, month, day] = command.baseContentVersion.split(".");
  return `quiz-content/${year}${month}${day}-${command.idempotencyKey.slice(0, 12)}`;
};

const resultOf = (pullRequest: GitHubPullRequest, reused: boolean): PullRequestResult => ({
  number: pullRequest.number,
  url: pullRequest.html_url,
  branch: pullRequest.head.ref,
  state: pullRequest.merged_at
    ? "merged"
    : pullRequest.state === "closed"
      ? "closed"
      : "open",
  reused,
});

const recoverExistingPullRequest = async (
  github: GitHubRepositoryClient,
  command: ValidatedCommand,
  env: WorkerEnv,
  branch: string,
): Promise<PullRequestResult> => {
  const existing = await github.findPullRequest(branch);
  if (existing) return resultOf(existing, true);
  return resultOf(
    await github.createPullRequest({
      branch,
      baseBranch: env.GITHUB_BASE_BRANCH,
      title: command.title,
      body: command.body,
    }),
    true,
  );
};

export const createQuestionMasterPullRequest = async (
  github: GitHubRepositoryClient,
  env: WorkerEnv,
  command: ValidatedCommand,
  now: Date,
): Promise<PullRequestResult> => {
  const branch = branchName(command);
  if (await github.branchExists(branch)) {
    return recoverExistingPullRequest(github, command, env, branch);
  }

  const repository = await readRepositoryMaster(github, env);
  const prepared = prepareMasterUpdate(repository, command, now);
  const root = contentRoot(env);
  const descriptorById = new Map(prepared.manifest.datasets.map((descriptor) => [descriptor.id, descriptor]));
  const files = [
    {
      path: `${root}/manifest.json`,
      content: `${JSON.stringify(prepared.manifest, null, 2)}\n`,
    },
    ...prepared.datasets
      .filter((dataset) =>
        prepared.touchedPaths.includes(
          (descriptorById.get(dataset.datasetId) as QuestionMasterDatasetDescriptor).path,
        ),
      )
      .map((dataset) => ({
        path: `${root}/${(descriptorById.get(dataset.datasetId) as QuestionMasterDatasetDescriptor).path}`,
        content: `${JSON.stringify(dataset, null, 2)}\n`,
      })),
  ];

  try {
    await github.createCommitOnBranch({
      branch,
      baseCommitSha: repository.baseCommitSha,
      baseTreeSha: repository.baseTreeSha,
      message: command.commitMessage,
      files,
    });
  } catch (error) {
    if (error instanceof GitHubApiError && error.status === 422 && (await github.branchExists(branch))) {
      return recoverExistingPullRequest(github, command, env, branch);
    }
    throw error;
  }
  const pullRequest = await github.createPullRequest({
    branch,
    baseBranch: env.GITHUB_BASE_BRANCH,
    title: command.title,
    body: command.body,
  });
  return resultOf(pullRequest, false);
};

export const getQuestionMasterPullRequest = async (
  github: GitHubRepositoryClient,
  number: number,
): Promise<PullRequestResult> => resultOf(await github.getPullRequest(number), true);
