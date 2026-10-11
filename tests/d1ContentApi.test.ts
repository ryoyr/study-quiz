import assert from "node:assert/strict";
import test from "node:test";
import {
  D1ContentApiError,
  applyD1Changes,
  applyD1ChangesWithAccessSession,
  fetchD1QuestionMasterValue,
  normalizeContentApiBaseUrl,
  type D1AccessSessionTransport,
} from "../src/services/d1ContentApi.ts";
import type { ApplyD1ChangesCommand } from "../src/types/QuestionMaster.ts";

const command: ApplyD1ChangesCommand = {
  schemaVersion: 1,
  baseContentVersion: "2026.10.11.1",
  baseDatasetVersions: { "lpic-101": 1 },
  changes: [],
  message: "検証用変更",
  idempotencyKey: "a".repeat(64),
};

const successBody = {
  contentVersion: "2026.10.11.2",
  datasetVersions: { "lpic-101": 2 },
  appliedCount: 1,
  reused: false,
  updatedAt: "2026-10-11T05:00:00.000Z",
} as const;

test("D1 Worker URLはHTTPSを要求しlocalhostだけHTTPを許可する", () => {
  assert.equal(
    normalizeContentApiBaseUrl("https://study-quiz-content-db.example.workers.dev").href,
    "https://study-quiz-content-db.example.workers.dev/",
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

test("公開snapshot APIはGET /api/content/snapshotだけをno-storeで取得する", async () => {
  let actualUrl = "";
  let actualInit: RequestInit | undefined;
  const fetcher: typeof fetch = async (input, init) => {
    actualUrl = input instanceof URL ? input.href : String(input);
    actualInit = init;
    return new Response(JSON.stringify({ manifest: {}, datasets: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  const value = await fetchD1QuestionMasterValue(
    new URL("https://worker.example.com/"),
    fetcher,
  );
  assert.deepEqual(value, { manifest: {}, datasets: [] });
  assert.equal(actualUrl, "https://worker.example.com/api/content/snapshot");
  assert.equal(actualInit?.cache, "no-store");
  assert.equal(actualInit?.method, undefined);
});

test("D1直接書込み境界は変更API・Cookie・冪等キーを維持する", async () => {
  let actualUrl = "";
  let actualInit: RequestInit | undefined;
  const fetcher: typeof fetch = async (input, init) => {
    actualUrl = input instanceof URL ? input.href : String(input);
    actualInit = init;
    return new Response(JSON.stringify(successBody), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  const result = await applyD1Changes(
    command,
    new URL("https://worker.example.com/"),
    fetcher,
  );
  assert.deepEqual(result, successBody);
  assert.equal(actualUrl, "https://worker.example.com/api/content/changes");
  assert.equal(actualInit?.method, "POST");
  assert.equal(actualInit?.credentials, "include");
  assert.equal(
    (actualInit?.headers as Record<string, string>)["x-idempotency-key"],
    command.idempotencyKey,
  );
  assert.deepEqual(JSON.parse(String(actualInit?.body)), command);
});

test("Accessセッション経由はD1変更コマンドだけを認証済みpopupへ渡す", async () => {
  let actualBaseUrl = "";
  let actualCommand: ApplyD1ChangesCommand | null = null;
  const transport: D1AccessSessionTransport = async (baseUrl, input) => {
    actualBaseUrl = baseUrl.href;
    actualCommand = input;
    return new Response(JSON.stringify(successBody), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  const result = await applyD1ChangesWithAccessSession(
    command,
    new URL("https://worker.example.com/"),
    transport,
  );
  assert.deepEqual(result, successBody);
  assert.equal(actualBaseUrl, "https://worker.example.com/");
  assert.deepEqual(actualCommand, command);
});

test("D1 APIは不正成功応答と安全な409エラーを区別する", async () => {
  const invalidFetcher: typeof fetch = async () =>
    new Response(JSON.stringify({ ...successBody, datasetVersions: {} }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  await assert.rejects(
    applyD1Changes(command, new URL("https://worker.example.com/"), invalidFetcher),
    (error: unknown) =>
      error instanceof D1ContentApiError && error.code === "INVALID_RESPONSE",
  );

  const conflictFetcher: typeof fetch = async () =>
    new Response(JSON.stringify({
      error: {
        code: "QUESTION_CONFLICT",
        message: "D1側で変更されています。",
        action: "最新版を取得してください。",
      },
    }), {
      status: 409,
      headers: { "content-type": "application/json" },
    });
  await assert.rejects(
    applyD1Changes(command, new URL("https://worker.example.com/"), conflictFetcher),
    (error: unknown) =>
      error instanceof D1ContentApiError &&
      error.status === 409 &&
      error.code === "QUESTION_CONFLICT" &&
      error.action === "最新版を取得してください。",
  );
});
