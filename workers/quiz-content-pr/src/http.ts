import type { WorkerEnv } from "./types";

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

export const requireAllowedOrigin = (request: Request, env: WorkerEnv): void => {
  const origin = request.headers.get("origin");
  if (!origin || origin !== env.ALLOWED_ORIGIN) {
    throw new ApiError(
      403,
      "ORIGIN_NOT_ALLOWED",
      "このオリジンからのGitHub連携は許可されていません。",
      "WorkersのALLOWED_ORIGINとGitHub PagesのURLを確認してください。",
    );
  }
};
