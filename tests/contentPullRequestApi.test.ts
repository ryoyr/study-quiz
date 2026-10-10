import assert from "node:assert/strict";
import test from "node:test";
import {
  ContentPullRequestApiError,
  createContentPullRequest,
  createContentPullRequestWithAccessSession,
  getContentPullRequestStatus,
  getContentPullRequestStatusWithAccessSession,
  normalizeContentApiBaseUrl,
  type ContentAccessSessionTransport,
} from "../src/services/contentPullRequestApi.ts";
import type { CreateContentPullRequestCommand } from "../src/types/QuestionMaster.ts";

const command: CreateContentPullRequestCommand = {
  schemaVersion: 1,
  baseContentVersion: "2026.10.11.1",
  baseDatasetVersions: { "lpic-101": 1 },
  changes: [],
  title: "title",
  body: "body",
  commitMessage: "message",
  idempotencyKey: "a".repeat(64),
};

const successBody = {
  number: 12,
  url: "https://github.com/ryoyr/study-quiz/pull/12",
  branch: "quiz-content/20261011-aaaaaaaaaaaa",
  state: "open",
  reused: false,
} as const;

test("Workers APIはHTTPSを要求しlocalhostだけHTTPを許可する", () => {
  assert.equal(
    normalizeContentApiBaseUrl(
      "https://study-quiz-content-pr.forxdevelop.workers.dev",
    ).href,
    "https://study-quiz-content-pr.forxdevelop.workers.dev/",
  );
  assert.equal(
    normalizeContentApiBaseUrl("http://localhost:8787").href,
    "http://localhost:8787/",
  );
  assert.throws(
    () => normalizeContentApiBaseUrl("http://worker.example.com"),
    /HTTPS/u,
  );
});

test("直接API互換はCookie認証と冪等キーを維持する", async () => {
  let request: RequestInit | undefined;
  const fetcher: typeof fetch = async (_input, init) => {
    request = init;
    return new Response(JSON.stringify(successBody), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  };
  const result = await createContentPullRequest(
    command,
    new URL("https://study-quiz-content-pr.forxdevelop.workers.dev/"),
    fetcher,
  );
  assert.equal(result.number, 12);
  assert.equal(request?.credentials, "include");
  assert.equal(
    (request?.headers as Record<string, string>)["x-idempotency-key"],
    command.idempotencyKey,
  );
});

test("Accessセッション経由はPRコマンドだけを認証済みポップアップへ渡す", async () => {
  let actualBaseUrl = "";
  let actualRequest: unknown;
  const transport: ContentAccessSessionTransport = async (baseUrl, request) => {
    actualBaseUrl = baseUrl.href;
    actualRequest = request;
    return new Response(JSON.stringify(successBody), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  };
  const result = await createContentPullRequestWithAccessSession(
    command,
    new URL("https://study-quiz-content-pr.forxdevelop.workers.dev/"),
    transport,
  );
  assert.equal(result.number, 12);
  assert.equal(
    actualBaseUrl,
    "https://study-quiz-content-pr.forxdevelop.workers.dev/",
  );
  assert.deepEqual(actualRequest, { action: "create", command });
});

test("Accessセッション経由の状態確認は正のPR番号だけを許可する", async () => {
  let actualRequest: unknown;
  const transport: ContentAccessSessionTransport = async (_baseUrl, request) => {
    actualRequest = request;
    return new Response(JSON.stringify(successBody), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  await getContentPullRequestStatusWithAccessSession(
    12,
    new URL("https://study-quiz-content-pr.forxdevelop.workers.dev/"),
    transport,
  );
  assert.deepEqual(actualRequest, {
    action: "status",
    pullRequestNumber: 12,
  });
  await assert.rejects(
    getContentPullRequestStatusWithAccessSession(
      0,
      new URL("https://study-quiz-content-pr.forxdevelop.workers.dev/"),
      transport,
    ),
    /番号が不正/u,
  );
});

test("安全に整形されたAPIエラーだけを画面へ渡す", async () => {
  const fetcher: typeof fetch = async () =>
    new Response(
      JSON.stringify({
        error: {
          code: "CONFLICT",
          message: "問題マスターが更新されています。",
          action: "最新版を取得してください。",
        },
      }),
      { status: 409, headers: { "content-type": "application/json" } },
    );
  await assert.rejects(
    getContentPullRequestStatus(
      12,
      new URL("https://study-quiz-content-pr.forxdevelop.workers.dev/"),
      fetcher,
    ),
    (error: unknown) =>
      error instanceof ContentPullRequestApiError &&
      error.status === 409 &&
      error.code === "CONFLICT" &&
      error.action === "最新版を取得してください。",
  );
});
