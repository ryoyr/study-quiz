import type { WorkerEnv } from "./types";

export const SNAPSHOT_PATH = "/api/content/snapshot";
export const CHANGES_PATH = "/api/content/changes";
export const ACCESS_SESSION_PATH = "/api/content/access-session";
export const HEALTH_PATH = "/api/content/health";
export const ACCESS_RELAY_HEADER = "x-study-quiz-access-relay";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly action = "",
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const allowedOrigin = (env: WorkerEnv): string =>
  env.ALLOWED_ORIGIN.trim().replace(/\/$/u, "");

export const corsHeaders = (request: Request, env: WorkerEnv): Headers => {
  const headers = new Headers({
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,x-idempotency-key,x-study-quiz-access-relay",
    "access-control-max-age": "86400",
    vary: "Origin",
  });
  if (request.headers.get("origin") === allowedOrigin(env)) {
    headers.set("access-control-allow-origin", allowedOrigin(env));
    headers.set("access-control-allow-credentials", "true");
  }
  return headers;
};

export const jsonResponse = (
  request: Request,
  env: WorkerEnv,
  value: unknown,
  status = 200,
): Response => {
  const headers = corsHeaders(request, env);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", status === 200 && new URL(request.url).pathname === SNAPSHOT_PATH
    ? "public, max-age=60, stale-while-revalidate=300"
    : "no-store");
  headers.set("x-content-type-options", "nosniff");
  return new Response(JSON.stringify(value), { status, headers });
};

export const errorResponse = (request: Request, env: WorkerEnv, error: unknown): Response => {
  const apiError = error instanceof ApiError
    ? error
    : new ApiError(500, "INTERNAL_ERROR", "D1 Workerで処理を完了できませんでした。", "Workerログを確認してください。");
  return jsonResponse(request, env, {
    error: { code: apiError.code, message: apiError.message, action: apiError.action },
  }, apiError.status);
};

export const assertAllowedRequestOrigin = (request: Request, env: WorkerEnv): void => {
  const origin = request.headers.get("origin");
  const sameOriginRelay = request.headers.get(ACCESS_RELAY_HEADER) === "1" &&
    (!origin || origin === new URL(request.url).origin);
  if (origin === allowedOrigin(env) || sameOriginRelay) return;
  throw new ApiError(403, "ORIGIN_DENIED", "このOriginからのD1書込みは許可されていません。");
};

export const accessSessionResponse = (env: WorkerEnv): Response => {
  const nonce = crypto.randomUUID().replace(/-/gu, "");
  const openerOrigin = JSON.stringify(allowedOrigin(env));
  const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>D1 Access session</title></head>
<body><main><h1>Study Quiz D1認証</h1><p>認証済みです。元の画面から送信内容を受け付けます。</p></main>
<script nonce="${nonce}">
const OPENER_ORIGIN=${openerOrigin};
const READY="study-quiz-d1-access-session-ready";
const REQUEST="study-quiz-d1-access-session-request";
const RESPONSE="study-quiz-d1-access-session-response";
if(window.opener) window.opener.postMessage({type:READY},OPENER_ORIGIN);
window.addEventListener("message",async(event)=>{
  if(event.origin!==OPENER_ORIGIN||event.source!==window.opener||event.data?.type!==REQUEST||event.data?.action!=="apply") return;
  let status=500,body={error:{code:"ACCESS_RELAY_FAILED",message:"D1への中継に失敗しました。"}};
  try{
    const response=await fetch(${JSON.stringify(CHANGES_PATH)},{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json","accept":"application/json","x-idempotency-key":event.data.command?.idempotencyKey??"","${ACCESS_RELAY_HEADER}":"1"},body:JSON.stringify(event.data.command)});
    status=response.status; body=await response.json();
  }catch(_error){}
  window.opener?.postMessage({type:RESPONSE,requestId:event.data.requestId,status,body},OPENER_ORIGIN);
},false);
</script></body></html>`;
  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "content-security-policy": `default-src 'none'; script-src 'nonce-${nonce}'; connect-src 'self'; style-src 'none'; base-uri 'none'; frame-ancestors 'none'`,
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
    },
  });
};
