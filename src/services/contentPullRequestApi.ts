import type {
  ContentApiErrorBody,
  CreateContentPullRequestCommand,
  CreateContentPullRequestResult,
} from "../types/QuestionMaster";

const API_PATH = "api/quiz-content/pull-requests";
const ACCESS_SESSION_PATH = "api/quiz-content/access-session";
const ACCESS_SESSION_READY_MESSAGE =
  "study-quiz-content-access-session-ready";
const ACCESS_SESSION_REQUEST_MESSAGE =
  "study-quiz-content-access-session-request";
const ACCESS_SESSION_RESPONSE_MESSAGE =
  "study-quiz-content-access-session-response";
const ACCESS_SESSION_TIMEOUT_MS = 2 * 60_000;

type ContentApiImportMeta = ImportMeta & {
  readonly env: {
    readonly VITE_QUIZ_CONTENT_API_URL?: string;
  };
};

type AccessSessionRequest =
  | {
      action: "create";
      command: CreateContentPullRequestCommand;
    }
  | {
      action: "status";
      pullRequestNumber: number;
    };

interface AccessSessionResponseMessage {
  type?: string;
  requestId?: string;
  status?: number;
  body?: unknown;
}

export type ContentAccessSessionTransport = (
  baseUrl: URL,
  request: AccessSessionRequest,
) => Promise<Response>;

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

export const requestThroughContentAccessSession: ContentAccessSessionTransport = (
  baseUrl,
  request,
) => {
  if (typeof window === "undefined") {
    return Promise.reject(
      new ContentPullRequestApiError(
        500,
        "BROWSER_REQUIRED",
        "Cloudflare Access認証にはブラウザーが必要です。",
      ),
    );
  }

  const requestId = crypto.randomUUID();
  const sessionUrl = new URL(ACCESS_SESSION_PATH, baseUrl);
  const popup = window.open(
    sessionUrl,
    `study-quiz-content-access-${requestId}`,
    "popup,width=560,height=640,resizable=yes,scrollbars=yes",
  );
  if (!popup) {
    return Promise.reject(
      new ContentPullRequestApiError(
        0,
        "ACCESS_POPUP_BLOCKED",
        "Cloudflare Access認証ウィンドウを開けませんでした。",
        "このサイトのポップアップを許可してから再試行してください。",
      ),
    );
  }

  return new Promise<Response>((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timeoutId);
      window.clearInterval(closeCheckId);
      if (!popup.closed) popup.close();
    };
    const finish = (operation: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      operation();
    };
    const onMessage = (event: MessageEvent<unknown>) => {
      if (event.origin !== baseUrl.origin || event.source !== popup) return;
      const message = event.data as AccessSessionResponseMessage | null;
      if (message?.type === ACCESS_SESSION_READY_MESSAGE) {
        popup.postMessage(
          {
            type: ACCESS_SESSION_REQUEST_MESSAGE,
            requestId,
            ...request,
          },
          baseUrl.origin,
        );
        return;
      }
      if (
        message?.type !== ACCESS_SESSION_RESPONSE_MESSAGE ||
        message.requestId !== requestId
      ) {
        return;
      }
      if (
        !Number.isInteger(message.status) ||
        Number(message.status) < 100 ||
        Number(message.status) > 599
      ) {
        finish(() =>
          reject(
            new ContentPullRequestApiError(
              0,
              "ACCESS_SESSION_FAILED",
              "Cloudflare Access認証後のAPI通信に失敗しました。",
              "Access設定とWorkersログを確認してください。",
            ),
          ),
        );
        return;
      }
      finish(() =>
        resolve(
          new Response(JSON.stringify(message.body ?? null), {
            status: Number(message.status),
            headers: { "content-type": "application/json" },
          }),
        ),
      );
    };
    window.addEventListener("message", onMessage);
    const timeoutId = window.setTimeout(
      () =>
        finish(() =>
          reject(
            new ContentPullRequestApiError(
              0,
              "ACCESS_SESSION_TIMEOUT",
              "Cloudflare Access認証が時間内に完了しませんでした。",
              "認証ウィンドウを確認して再試行してください。",
            ),
          ),
        ),
      ACCESS_SESSION_TIMEOUT_MS,
    );
    const closeCheckId = window.setInterval(() => {
      if (!popup.closed) return;
      finish(() =>
        reject(
          new ContentPullRequestApiError(
            0,
            "ACCESS_SESSION_CLOSED",
            "Cloudflare Access認証が完了する前にウィンドウが閉じられました。",
          ),
        ),
      );
    }, 250);
  });
};

export const createContentPullRequestWithAccessSession = async (
  command: CreateContentPullRequestCommand,
  baseUrl: URL,
  transport: ContentAccessSessionTransport = requestThroughContentAccessSession,
): Promise<CreateContentPullRequestResult> =>
  parseResult(await transport(baseUrl, { action: "create", command }));

export const getContentPullRequestStatusWithAccessSession = async (
  pullRequestNumber: number,
  baseUrl: URL,
  transport: ContentAccessSessionTransport = requestThroughContentAccessSession,
): Promise<CreateContentPullRequestResult> => {
  if (!Number.isInteger(pullRequestNumber) || pullRequestNumber <= 0) {
    throw new Error("Pull Request番号が不正です。");
  }
  return parseResult(
    await transport(baseUrl, { action: "status", pullRequestNumber }),
  );
};
