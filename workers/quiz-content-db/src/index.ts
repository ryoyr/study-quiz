import { verifyAccessIdentity } from "./auth";
import {
  ACCESS_SESSION_PATH,
  CHANGES_PATH,
  HEALTH_PATH,
  SNAPSHOT_PATH,
  ApiError,
  accessSessionResponse,
  assertAllowedRequestOrigin,
  corsHeaders,
  errorResponse,
  jsonResponse,
} from "./http";
import { applyQuestionChanges, readHealth, readQuestionMasterSnapshot } from "./repository";
import type { WorkerEnv } from "./types";
import { parseApplyCommand, verifyIdempotencyKey } from "./validation";

const MAX_BODY_BYTES = 2 * 1024 * 1024;

const handle = async (request: Request, env: WorkerEnv): Promise<Response> => {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") {
    if (request.headers.get("origin") !== env.ALLOWED_ORIGIN.replace(/\/$/u, "")) {
      throw new ApiError(403, "ORIGIN_DENIED", "このOriginは許可されていません。");
    }
    return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  }
  if (request.method === "GET" && url.pathname === SNAPSHOT_PATH) {
    return jsonResponse(request, env, await readQuestionMasterSnapshot(env));
  }
  if (request.method === "GET" && url.pathname === HEALTH_PATH) {
    return jsonResponse(request, env, await readHealth(env));
  }
  if (request.method === "GET" && url.pathname === ACCESS_SESSION_PATH) {
    await verifyAccessIdentity(request, env);
    return accessSessionResponse(env);
  }
  if (request.method === "POST" && url.pathname === CHANGES_PATH) {
    assertAllowedRequestOrigin(request, env);
    const length = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(length) && length > MAX_BODY_BYTES) {
      throw new ApiError(413, "PAYLOAD_TOO_LARGE", "D1変更payloadは2MiB以下にしてください。");
    }
    const identity = await verifyAccessIdentity(request, env);
    let value: unknown;
    try {
      const body = await request.text();
      if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) throw new ApiError(413, "PAYLOAD_TOO_LARGE", "D1変更payloadは2MiB以下にしてください。");
      value = JSON.parse(body);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(400, "INVALID_JSON", "D1変更payloadをJSONとして読み込めませんでした。");
    }
    let command;
    try {
      command = parseApplyCommand(value, request.headers.get("x-idempotency-key"));
      await verifyIdempotencyKey(command);
    } catch (error) {
      throw new ApiError(400, "INVALID_COMMAND", error instanceof Error ? error.message : "D1変更コマンドが不正です。");
    }
    return jsonResponse(request, env, await applyQuestionChanges(env, command, identity), 200);
  }
  throw new ApiError(404, "NOT_FOUND", "APIが見つかりません。");
};

export const handleRequest = async (request: Request, env: WorkerEnv): Promise<Response> => {
  try {
    return await handle(request, env);
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(request, env, error);
    if (error instanceof Error && /Access|サインイン|書込み権限/u.test(error.message)) {
      const status = /権限/u.test(error.message) ? 403 : 401;
      return errorResponse(request, env, new ApiError(status, status === 401 ? "AUTHENTICATION_REQUIRED" : "FORBIDDEN", error.message));
    }
    return errorResponse(request, env, error);
  }
};

export default {
  fetch(request: Request, env: WorkerEnv): Promise<Response> {
    return handleRequest(request, env);
  },
};
