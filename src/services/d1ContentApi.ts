import type {
  ApplyD1ChangesCommand,
  ApplyD1ChangesResult,
  ContentApiErrorBody,
} from "../types/QuestionMaster";

const SNAPSHOT_PATH = "api/content/snapshot";
const CHANGES_PATH = "api/content/changes";
const ACCESS_SESSION_PATH = "api/content/access-session";
const ACCESS_SESSION_READY_MESSAGE = "study-quiz-d1-access-session-ready";
const ACCESS_SESSION_REQUEST_MESSAGE = "study-quiz-d1-access-session-request";
const ACCESS_SESSION_RESPONSE_MESSAGE = "study-quiz-d1-access-session-response";
const ACCESS_SESSION_TIMEOUT_MS = 2 * 60_000;
const NETWORK_TIMEOUT_MS = 8_000;

type ContentApiImportMeta = ImportMeta & {
  readonly env?: { readonly VITE_QUIZ_CONTENT_API_URL?: string };
};

interface AccessSessionResponseMessage {
  type?: string;
  requestId?: string;
  status?: number;
  body?: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isPositiveDatasetVersions = (
  value: unknown,
): value is Record<string, number> =>
  isRecord(value) &&
  Object.keys(value).length > 0 &&
  Object.entries(value).every(
    ([datasetId, version]) =>
      /^[a-z0-9][a-z0-9-]{0,63}$/u.test(datasetId) &&
      Number.isInteger(version) &&
      Number(version) > 0,
  );

export type D1AccessSessionTransport = (
  baseUrl: URL,
  command: ApplyD1ChangesCommand,
) => Promise<Response>;

export class D1ContentApiError extends Error {
  readonly code: string;
  readonly action: string;
  readonly status: number;

  constructor(status: number, code: string, message: string, action = "") {
    super(message);
    this.name = "D1ContentApiError";
    this.status = status;
    this.code = code;
    this.action = action;
  }
}

export const normalizeContentApiBaseUrl = (value: string): URL => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("D1 Worker APIエンドポイントが絶対URLではありません。");
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
    throw new Error("D1 Worker APIエンドポイントはHTTPSで指定してください。");
  }
  url.search = "";
  url.hash = "";
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url;
};

export const configuredContentApiBaseUrl = (): URL | null => {
  const value = (import.meta as ContentApiImportMeta).env
    ?.VITE_QUIZ_CONTENT_API_URL?.trim();
  return value ? normalizeContentApiBaseUrl(value) : null;
};

const parseError = async (response: Response): Promise<never> => {
  let body: ContentApiErrorBody = {};
  try {
    body = (await response.json()) as ContentApiErrorBody;
  } catch {
    // HTML等をそのまま画面へ露出しない。
  }
  throw new D1ContentApiError(
    response.status,
    body.error?.code ?? "D1_CONTENT_API_ERROR",
    body.error?.message ?? `D1連携に失敗しました（HTTP ${response.status}）。`,
    body.error?.action ?? "接続状態とWorkerログを確認してください。",
  );
};

const timedFetch = async (
  fetcher: typeof fetch,
  input: RequestInfo | URL,
  init: RequestInit,
): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
  try {
    return await fetcher(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

export const fetchD1QuestionMasterValue = async (
  baseUrl: URL,
  fetcher: typeof fetch = fetch,
): Promise<unknown> => {
  const response = await timedFetch(
    fetcher,
    new URL(SNAPSHOT_PATH, baseUrl),
    { headers: { accept: "application/json" }, cache: "no-store" },
  );
  if (!response.ok) return parseError(response);
  return response.json();
};

const parseApplyResult = async (response: Response): Promise<ApplyD1ChangesResult> => {
  if (!response.ok) return parseError(response);
  const value: unknown = await response.json();
  if (!isRecord(value)) {
    throw new D1ContentApiError(502, "INVALID_RESPONSE", "D1 Workerの応答形式が不正です。");
  }
  if (
    typeof value.contentVersion !== "string" ||
    !/^\d{4}\.\d{2}\.\d{2}\.\d+$/u.test(value.contentVersion) ||
    !isPositiveDatasetVersions(value.datasetVersions) ||
    !Number.isInteger(value.appliedCount) ||
    Number(value.appliedCount) < 0 ||
    typeof value.reused !== "boolean" ||
    typeof value.updatedAt !== "string" ||
    !Number.isFinite(Date.parse(value.updatedAt))
  ) {
    throw new D1ContentApiError(502, "INVALID_RESPONSE", "D1 Workerの応答内容を検証できませんでした。");
  }
  return {
    contentVersion: value.contentVersion,
    datasetVersions: value.datasetVersions,
    appliedCount: Number(value.appliedCount),
    reused: value.reused,
    updatedAt: value.updatedAt,
  };
};

export const applyD1Changes = async (
  command: ApplyD1ChangesCommand,
  baseUrl: URL,
  fetcher: typeof fetch = fetch,
): Promise<ApplyD1ChangesResult> =>
  parseApplyResult(
    await timedFetch(fetcher, new URL(CHANGES_PATH, baseUrl), {
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

export const requestThroughD1AccessSession: D1AccessSessionTransport = (
  baseUrl,
  command,
) => {
  if (typeof window === "undefined") {
    return Promise.reject(
      new D1ContentApiError(500, "BROWSER_REQUIRED", "Cloudflare Access認証にはブラウザーが必要です。"),
    );
  }
  const requestId = crypto.randomUUID();
  const popup = window.open(
    new URL(ACCESS_SESSION_PATH, baseUrl),
    `study-quiz-d1-access-${requestId}`,
    "popup,width=560,height=640,resizable=yes,scrollbars=yes",
  );
  if (!popup) {
    return Promise.reject(
      new D1ContentApiError(
        0,
        "ACCESS_POPUP_BLOCKED",
        "Cloudflare Access認証ウィンドウを開けませんでした。",
        "このサイトのポップアップを許可してください。",
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
          { type: ACCESS_SESSION_REQUEST_MESSAGE, requestId, action: "apply", command },
          baseUrl.origin,
        );
        return;
      }
      if (
        message?.type !== ACCESS_SESSION_RESPONSE_MESSAGE ||
        message.requestId !== requestId ||
        !Number.isInteger(message.status) ||
        Number(message.status) < 100 ||
        Number(message.status) > 599
      ) return;
      finish(() => resolve(new Response(JSON.stringify(message.body ?? null), {
        status: Number(message.status),
        headers: { "content-type": "application/json" },
      })));
    };
    window.addEventListener("message", onMessage);
    const timeoutId = window.setTimeout(
      () => finish(() => reject(new D1ContentApiError(0, "ACCESS_SESSION_TIMEOUT", "Cloudflare Access認証が時間内に完了しませんでした。"))),
      ACCESS_SESSION_TIMEOUT_MS,
    );
    const closeCheckId = window.setInterval(() => {
      if (popup.closed) finish(() => reject(new D1ContentApiError(0, "ACCESS_SESSION_CLOSED", "認証完了前にウィンドウが閉じられました。")));
    }, 250);
  });
};

export const applyD1ChangesWithAccessSession = async (
  command: ApplyD1ChangesCommand,
  baseUrl: URL,
  transport: D1AccessSessionTransport = requestThroughD1AccessSession,
): Promise<ApplyD1ChangesResult> =>
  parseApplyResult(await transport(baseUrl, command));
