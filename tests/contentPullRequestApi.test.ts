import assert from "node:assert/strict";
import test from "node:test";
import {
  ContentPullRequestApiError,
  createContentPullRequest,
  getContentPullRequestStatus,
  normalizeContentApiBaseUrl,
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

test("Workers APIはHTTPSを要求しlocalhostだけHTTPを許可する", () => {
  assert.equal(
    normalizeContentApiBaseUrl("https://worker.example.com").href,
    "https://worker.example.com/",
  );
  assert.equal(
    normalizeContentApiBaseUrl("http://localhost:8787").href,
    "http://localhost:8787/",
  );
  assert.throws(() => normalizeContentApiBaseUrl("http://worker.example.com"), /HTTPS/u);
});

test("PR作成はCookie認証と冪等キーを付け、成功応答を検証する", async () => {
  let request: RequestInit | undefined;
  const fetcher: typeof fetch = async (_input, init) => {
    request = init;
    return new Response(
      JSON.stringify({
        number: 12,
        url: "https://github.com/example/study-quiz/pull/12",
        branch: "quiz-content/20261011-aaaaaaaaaaaa",
        state: "open",
        reused: false,
      }),
      { status: 201, headers: { "content-type": "application/json" } },
    );
  };
  const result = await createContentPullRequest(
    command,
    new URL("https://worker.example.com/"),
    fetcher,
  );
  assert.equal(result.number, 12);
  assert.equal(request?.credentials, "include");
  assert.equal(
    (request?.headers as Record<string, string>)["x-idempotency-key"],
    command.idempotencyKey,
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
    getContentPullRequestStatus(12, new URL("https://worker.example.com/"), fetcher),
    (error: unknown) =>
      error instanceof ContentPullRequestApiError &&
      error.status === 409 &&
      error.code === "CONFLICT" &&
      error.action === "最新版を取得してください。",
  );
});
