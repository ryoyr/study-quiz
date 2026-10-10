import { verifyAccessIdentity } from "./auth";
import { createGitHubClient, GitHubApiError } from "./github";
import {
  ApiError,
  corsHeaders,
  errorResponse,
  jsonResponse,
  requireAllowedOrigin,
} from "./http";
import {
  createQuestionMasterPullRequest,
  getQuestionMasterPullRequest,
} from "./pullRequestService";
import type { WorkerDependencies, WorkerEnv } from "./types";
import { MAX_REQUEST_BYTES, parseCommand } from "./validation";

const BASE_PATH = "/api/quiz-content/pull-requests";

const defaultDependencies: WorkerDependencies = {
  authenticate: verifyAccessIdentity,
  createGitHubClient,
  now: () => new Date(),
};

const githubError = (error: GitHubApiError): ApiError => {
  if (error.status === 401 || error.status === 403) {
    return new ApiError(
      502,
      "GITHUB_PERMISSION_DENIED",
      "GitHub Appの権限で処理を実行できませんでした。",
      "GitHub Appのインストール先とContents・Pull requests権限を確認してください。",
    );
  }
  if (error.status === 429) {
    return new ApiError(
      503,
      "GITHUB_RATE_LIMITED",
      "GitHub APIのレート制限に達しました。",
      "しばらく待ってから同じ内容を再送してください。冪等キーにより重複作成を防ぎます。",
    );
  }
  return new ApiError(
    502,
    "GITHUB_API_ERROR",
    "GitHub APIとの連携に失敗しました。",
    "GitHubの状態とWorkersログを確認してから再試行してください。",
  );
};

const ensureConfiguration = (env: WorkerEnv): void => {
  let origin: URL;
  try {
    origin = new URL(env.ALLOWED_ORIGIN);
  } catch {
    throw new ApiError(503, "ORIGIN_NOT_CONFIGURED", "ALLOWED_ORIGINが未設定です。");
  }
  if (origin.origin !== env.ALLOWED_ORIGIN || origin.protocol !== "https:") {
    throw new ApiError(
      503,
      "ORIGIN_NOT_CONFIGURED",
      "ALLOWED_ORIGINはHTTPSのオリジンだけを指定してください。",
    );
  }
  if (!env.RATE_LIMITER) {
    throw new ApiError(
      503,
      "RATE_LIMIT_NOT_CONFIGURED",
      "Workers Rate Limiting bindingが未設定です。",
    );
  }
};

const applyRateLimit = async (
  env: WorkerEnv,
  key: string,
): Promise<void> => {
  const result = await (env.RATE_LIMITER as NonNullable<WorkerEnv["RATE_LIMITER"]>).limit({ key });
  if (!result.success) {
    throw new ApiError(
      429,
      "RATE_LIMITED",
      "GitHub連携の操作回数が上限に達しました。",
      "1分待ってから再試行してください。",
    );
  }
};

export const handleRequest = async (
  request: Request,
  env: WorkerEnv,
  dependencies: WorkerDependencies = defaultDependencies,
): Promise<Response> => {
  try {
    ensureConfiguration(env);
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      requireAllowedOrigin(request, env);
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }
    requireAllowedOrigin(request, env);
    const statusMatch = new RegExp(`^${BASE_PATH}/([1-9]\\d*)$`, "u").exec(url.pathname);
    const isCreate = request.method === "POST" && url.pathname === BASE_PATH;
    const isStatus = request.method === "GET" && statusMatch !== null;
    if (!isCreate && !isStatus) {
      throw new ApiError(404, "NOT_FOUND", "指定されたAPIは存在しません。");
    }

    const identity = await dependencies.authenticate(request, env);
    await applyRateLimit(env, `${identity.subject}:${url.pathname}:${request.method}`);
    const github = await dependencies.createGitHubClient(env);

    if (isStatus && statusMatch) {
      const result = await getQuestionMasterPullRequest(
        github,
        Number(statusMatch[1]),
      );
      return jsonResponse(result, 200, env);
    }

    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
      throw new ApiError(413, "REQUEST_TOO_LARGE", "送信内容が上限を超えています。");
    }
    const command = await parseCommand(
      await request.text(),
      request.headers.get("x-idempotency-key"),
    );
    const result = await createQuestionMasterPullRequest(
      github,
      env,
      command,
      dependencies.now(),
    );
    return jsonResponse(result, result.reused ? 200 : 201, env);
  } catch (error) {
    return errorResponse(
      error instanceof GitHubApiError ? githubError(error) : error,
      env,
    );
  }
};

export default {
  fetch(request: Request, env: WorkerEnv): Promise<Response> {
    return handleRequest(request, env);
  },
};
