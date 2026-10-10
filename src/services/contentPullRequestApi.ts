import type {
  ContentApiErrorBody,
  CreateContentPullRequestCommand,
  CreateContentPullRequestResult,
} from "../types/QuestionMaster";

const API_PATH = "api/quiz-content/pull-requests";

type ContentApiImportMeta = ImportMeta & {
  readonly env: {
    readonly VITE_QUIZ_CONTENT_API_URL?: string;
  };
};

export class ContentPullRequestApiError extends Error {
  readonly code: string;
  readonly action: string;
  readonly status: number;

  constructor(status: number, code: string, message: string, action = "") {
    super(message);
    this.name = "ContentPullRequestApiError";
    this.status = status;
    this.code = code;
    this.action = action;
  }
}

export const configuredContentApiBaseUrl = (): URL | null => {
  const value = (import.meta as ContentApiImportMeta).env
    .VITE_QUIZ_CONTENT_API_URL?.trim();
  if (!value) return null;
  return normalizeContentApiBaseUrl(value);
};

export const normalizeContentApiBaseUrl = (value: string): URL => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Workers APIエンドポイントが絶対URLではありません。");
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
    throw new Error("Workers APIエンドポイントはHTTPSで指定してください。");
  }
  url.search = "";
  url.hash = "";
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url;
};

const parseError = async (response: Response): Promise<never> => {
  let body: ContentApiErrorBody = {};
  try {
    body = (await response.json()) as ContentApiErrorBody;
  } catch {
    // HTMLなどの予期しない応答でも内部内容は画面へ露出しない。
  }
  throw new ContentPullRequestApiError(
    response.status,
    body.error?.code ?? "CONTENT_API_ERROR",
    body.error?.message ??
      `GitHub連携に失敗しました（HTTP ${response.status}）。`,
    body.error?.action ?? "しばらく待ってから再試行してください。",
  );
};

const parseResult = async (
  response: Response,
): Promise<CreateContentPullRequestResult> => {
  if (!response.ok) return parseError(response);

  const value: unknown = await response.json();
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ContentPullRequestApiError(
      502,
      "INVALID_RESPONSE",
      "Workers APIの応答形式が不正です。",
      "Workersのデプロイ版とアプリの版を確認してください。",
    );
  }

  const item = value as Partial<CreateContentPullRequestResult>;
  if (
    !Number.isInteger(item.number) ||
    Number(item.number) <= 0 ||
    typeof item.url !== "string" ||
    !/^https:\/\/github\.com\//u.test(item.url) ||
    typeof item.branch !== "string" ||
    !item.branch ||
    !["open", "closed", "merged"].includes(String(item.state)) ||
    typeof item.reused !== "boolean"
  ) {
    throw new ContentPullRequestApiError(
      502,
      "INVALID_RESPONSE",
      "Workers APIの応答内容を検証できませんでした。",
      "WorkersのログとGitHub側のPull Requestを確認してください。",
    );
  }

  return item as CreateContentPullRequestResult;
};

const endpointUrl = (baseUrl: URL, suffix = ""): URL =>
  new URL(`${API_PATH}${suffix}`, baseUrl);

export const createContentPullRequest = async (
  command: CreateContentPullRequestCommand,
  baseUrl: URL,
  fetcher: typeof fetch = fetch,
): Promise<CreateContentPullRequestResult> =>
  parseResult(
    await fetcher(endpointUrl(baseUrl), {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "x-idempotency-key": command.idempotencyKey,
      },
      body: JSON.stringify(command),
    }),
  );

export const getContentPullRequestStatus = async (
  pullRequestNumber: number,
  baseUrl: URL,
  fetcher: typeof fetch = fetch,
): Promise<CreateContentPullRequestResult> => {
  if (!Number.isInteger(pullRequestNumber) || pullRequestNumber <= 0) {
    throw new Error("Pull Request番号が不正です。");
  }

  return parseResult(
    await fetcher(endpointUrl(baseUrl, `/${pullRequestNumber}`), {
      credentials: "include",
      headers: { accept: "application/json" },
    }),
  );
};
