import type { WorkerEnv } from "./types";

export const ACCESS_SESSION_PATH = "/api/quiz-content/access-session";
export const PULL_REQUESTS_PATH = "/api/quiz-content/pull-requests";
export const ACCESS_SESSION_READY_MESSAGE =
  "study-quiz-content-access-session-ready";
export const ACCESS_SESSION_REQUEST_MESSAGE =
  "study-quiz-content-access-session-request";
export const ACCESS_SESSION_RESPONSE_MESSAGE =
  "study-quiz-content-access-session-response";
export const ACCESS_RELAY_HEADER = "x-study-quiz-access-relay";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly action: string;

  constructor(status: number, code: string, message: string, action = "") {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.action = action;
  }
}

export const corsHeaders = (env: WorkerEnv): HeadersInit => ({
  "access-control-allow-origin": env.ALLOWED_ORIGIN,
  "access-control-allow-credentials": "true",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, x-idempotency-key",
  "access-control-max-age": "600",
  vary: "Origin",
});

export const jsonResponse = (
  value: unknown,
  status: number,
  env: WorkerEnv,
): Response =>
  new Response(JSON.stringify(value), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...corsHeaders(env),
    },
  });

export const errorResponse = (error: unknown, env: WorkerEnv): Response => {
  const apiError =
    error instanceof ApiError
      ? error
      : new ApiError(
          500,
          "INTERNAL_ERROR",
          "GitHub連携の内部処理に失敗しました。",
          "Workersのログを確認し、秘密情報を含めずに管理者へ連絡してください。",
        );
  return jsonResponse(
    {
      error: {
        code: apiError.code,
        message: apiError.message,
        action: apiError.action,
      },
    },
    apiError.status,
    env,
  );
};

const isSameOriginAccessRelay = (request: Request): boolean => {
  if (request.headers.get(ACCESS_RELAY_HEADER) !== "1") return false;
  if (request.headers.get("sec-fetch-site") !== "same-origin") return false;
  const origin = request.headers.get("origin");
  return origin === null || origin === new URL(request.url).origin;
};

export const requireAllowedOrigin = (request: Request, env: WorkerEnv): void => {
  const origin = request.headers.get("origin");
  if (origin === env.ALLOWED_ORIGIN || isSameOriginAccessRelay(request)) return;
  throw new ApiError(
    403,
    "ORIGIN_NOT_ALLOWED",
    "このオリジンからのGitHub連携は許可されていません。",
    "WorkersのALLOWED_ORIGINとGitHub PagesのURLを確認してください。",
  );
};

const scriptLiteral = (value: string): string =>
  JSON.stringify(value)
    .replace(/</gu, "\\u003c")
    .replace(/\u2028/gu, "\\u2028")
    .replace(/\u2029/gu, "\\u2029");

export const accessSessionResponse = (
  env: WorkerEnv,
  workerOrigin: string,
): Response => {
  const nonce = crypto.randomUUID().replace(/-/gu, "");
  const script = `
(() => {
  "use strict";
  const allowedOrigin = ${scriptLiteral(env.ALLOWED_ORIGIN)};
  const workerOrigin = ${scriptLiteral(workerOrigin)};
  const apiPath = ${scriptLiteral(PULL_REQUESTS_PATH)};
  const readyType = ${scriptLiteral(ACCESS_SESSION_READY_MESSAGE)};
  const requestType = ${scriptLiteral(ACCESS_SESSION_REQUEST_MESSAGE)};
  const responseType = ${scriptLiteral(ACCESS_SESSION_RESPONSE_MESSAGE)};
  const relayHeader = ${scriptLiteral(ACCESS_RELAY_HEADER)};
  const openerWindow = window.opener;
  const status = document.getElementById("status");
  const send = (message) => openerWindow?.postMessage(message, allowedOrigin);
  if (!openerWindow) {
    status.textContent = "呼び出し元を確認できません。アプリから認証をやり直してください。";
    return;
  }
  window.addEventListener("message", async (event) => {
    if (event.origin !== allowedOrigin || event.source !== openerWindow) return;
    const message = event.data;
    if (!message || message.type !== requestType || typeof message.requestId !== "string") return;
    if (!/^[0-9a-f-]{36}$/u.test(message.requestId)) return;
    let method;
    let target;
    let headers = { accept: "application/json", [relayHeader]: "1" };
    let body;
    if (message.action === "create") {
      const command = message.command;
      if (!command || typeof command !== "object" || !/^[0-9a-f]{64}$/u.test(String(command.idempotencyKey ?? ""))) return;
      method = "POST";
      target = apiPath;
      headers = {
        ...headers,
        "content-type": "application/json",
        "x-idempotency-key": command.idempotencyKey,
      };
      body = JSON.stringify(command);
    } else if (message.action === "status") {
      if (!Number.isInteger(message.pullRequestNumber) || message.pullRequestNumber <= 0) return;
      method = "GET";
      target = apiPath + "/" + String(message.pullRequestNumber);
    } else {
      return;
    }
    status.textContent = "認証済みです。安全な同一オリジン経由で処理しています。";
    try {
      const response = await fetch(new URL(target, workerOrigin), {
        method,
        credentials: "same-origin",
        headers,
        body,
        redirect: "error",
      });
      const text = await response.text();
      let responseBody = null;
      try { responseBody = text ? JSON.parse(text) : null; } catch { /* 応答本文を露出しない */ }
      send({ type: responseType, requestId: message.requestId, status: response.status, body: responseBody });
    } catch {
      send({ type: responseType, requestId: message.requestId, status: 0, body: null });
    } finally {
      window.setTimeout(() => window.close(), 250);
    }
  });
  send({ type: readyType });
})();`;
  const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Study Quiz Cloudflare Access認証</title>
</head>
<body>
  <main>
    <h1>Cloudflare Access認証</h1>
    <p id="status">認証が完了しました。Study Quizと安全に接続しています。</p>
    <p>このウィンドウは処理後に自動で閉じます。</p>
  </main>
  <script nonce="${nonce}">${script}</script>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "content-security-policy": `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'none'; img-src 'none'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
      "cross-origin-resource-policy": "same-origin",
    },
  });
};
