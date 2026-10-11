import assert from "node:assert/strict";
import test from "node:test";
import { handleRequest } from "../workers/quiz-content-db/src/index.ts";
import type {
  D1Database,
  D1PreparedStatement,
  D1Result,
  WorkerEnv,
} from "../workers/quiz-content-db/src/types.ts";
import { questions } from "../src/data/questions.ts";

const row = {
  id: questions[0].id,
  dataset_id: "lpic-101",
  exam_scope_id: questions[0].examScopeId,
  category: questions[0].category,
  subcategory: questions[0].subcategory ?? null,
  text: questions[0].text,
  question_type: questions[0].questionType ?? "single",
  choices_json: JSON.stringify(questions[0].choices),
  answer_index: questions[0].answerIndex,
  answer_indices_json: null,
  accepted_answers_json: null,
  explanation: questions[0].explanation,
  source: questions[0].source ?? null,
  tags_json: JSON.stringify(questions[0].tags ?? []),
  weight: questions[0].weight,
  difficulty: questions[0].difficulty,
  archived_at: null,
  revision: 1,
  content_hash: "e8025020",
  created_at: "2026-10-11T00:00:00.000Z",
  updated_at: "2026-10-11T00:00:00.000Z",
};

class ReadStatement implements D1PreparedStatement {
  constructor(private readonly query: string) {}
  bind(): D1PreparedStatement { return this; }
  async first<T>(): Promise<T | null> {
    if (this.query.includes("COUNT(*)")) return { count: 1 } as T;
    if (this.query.includes("content_meta")) {
      return {
        value: "2026.10.11.1",
        updated_at: "2026-10-11T00:00:00.000Z",
      } as T;
    }
    return null;
  }
  async all<T>(): Promise<D1Result<T>> {
    if (this.query.includes("FROM datasets")) {
      return {
        results: [{
          id: "lpic-101",
          version: 1,
          title: "LPIC-101",
          updated_at: "2026-10-11T00:00:00.000Z",
        } as T],
        success: true,
        meta: {},
      };
    }
    if (this.query.includes("FROM questions")) {
      return { results: [row as T], success: true, meta: {} };
    }
    return { results: [], success: true, meta: {} };
  }
  async run<T>(): Promise<D1Result<T>> {
    throw new Error("read-only test DB");
  }
}

class ReadDatabase implements D1Database {
  prepare(query: string): D1PreparedStatement { return new ReadStatement(query); }
  async batch<T>(): Promise<D1Result<T>[]> { throw new Error("read-only test DB"); }
}

const env = (): WorkerEnv => ({
  DB: new ReadDatabase(),
  ALLOWED_ORIGIN: "http://app.local",
  ACCESS_TEAM_DOMAIN: "auth.cloudflareaccess.com",
  ACCESS_AUD: "audience",
  ALLOWED_EMAILS: "editor@example.com",
  ALLOW_LOCAL_WRITE: "true",
});

test("D1 Workerは公開healthとsnapshot APIを現在スキーマで返す", async () => {
  const health = await handleRequest(
    new Request("http://localhost/api/content/health", {
      headers: { origin: "http://app.local" },
    }),
    env(),
  );
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), {
    ok: true,
    contentVersion: "2026.10.11.1",
    questionCount: 1,
  });

  const snapshot = await handleRequest(
    new Request("http://localhost/api/content/snapshot", {
      headers: { origin: "http://app.local" },
    }),
    env(),
  );
  assert.equal(snapshot.status, 200);
  assert.equal(snapshot.headers.get("access-control-allow-origin"), "http://app.local");
  const body = await snapshot.json() as {
    manifest: { contentVersion: string; datasets: Array<{ questionCount: number }> };
    questions: Array<{ id: string }>;
  };
  assert.equal(body.manifest.contentVersion, "2026.10.11.1");
  assert.equal(body.manifest.datasets[0].questionCount, 1);
  assert.equal(body.questions[0].id, questions[0].id);
});

test("Access sessionは認証境界・same-origin relay・厳格CSPを維持する", async () => {
  const response = await handleRequest(
    new Request("http://localhost/api/content/access-session"),
    env(),
  );
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html/u);
  assert.match(response.headers.get("content-security-policy") ?? "", /default-src 'none'/u);
  const html = await response.text();
  assert.match(html, /study-quiz-d1-access-session-ready/u);
  assert.match(html, /credentials:"same-origin"/u);
  assert.match(html, /x-study-quiz-access-relay/u);
  assert.doesNotMatch(html, /ACCESS_AUD|ALLOWED_EMAILS/u);
});

test("OPTIONSは許可Originだけを受け入れる", async () => {
  const accepted = await handleRequest(
    new Request("http://localhost/api/content/changes", {
      method: "OPTIONS",
      headers: { origin: "http://app.local" },
    }),
    env(),
  );
  assert.equal(accepted.status, 204);
  const denied = await handleRequest(
    new Request("http://localhost/api/content/changes", {
      method: "OPTIONS",
      headers: { origin: "http://evil.local" },
    }),
    env(),
  );
  assert.equal(denied.status, 403);
});

test("HTTP書込み境界でもlocal-only問題をD1へ送信させない", async () => {
  const idempotencyKey = "a".repeat(64);
  const command = {
    schemaVersion: 1,
    baseContentVersion: "2026.10.11.1",
    baseDatasetVersions: { "lpic-101": 1 },
    changes: [{
      datasetId: "lpic-101",
      operation: "add",
      questionId: "LOCAL-ONLY-001",
      changedFields: ["text"],
      after: {
        ...questions[0],
        id: "LOCAL-ONLY-001",
        distribution: "local-only",
      },
    }],
    message: "不正な端末限定問題",
    idempotencyKey,
  };
  const response = await handleRequest(
    new Request("http://localhost/api/content/changes", {
      method: "POST",
      headers: {
        origin: "http://app.local",
        "content-type": "application/json",
        "x-idempotency-key": idempotencyKey,
      },
      body: JSON.stringify(command),
    }),
    env(),
  );
  assert.equal(response.status, 400);
  const body = await response.json() as { error: { code: string } };
  assert.equal(body.error.code, "INVALID_COMMAND");
});
