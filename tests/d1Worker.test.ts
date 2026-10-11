import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { questions } from "../src/data/questions.ts";
import {
  fingerprint,
  isQuestion,
  parseApplyCommand,
  verifyIdempotencyKey,
  stableJson,
} from "../workers/quiz-content-db/src/validation.ts";

const sha256 = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

test("WorkerのQuestion validatorはlocal-only属性の混入を拒否する", () => {
  assert.equal(isQuestion(questions[0]), true);
  assert.equal(isQuestion({ ...questions[0], distribution: "local-only" }), false);
});

test("Workerはcommand全体と冪等キーの一致を検証する", async () => {
  const after = { ...questions[0], explanation: "D1更新" };
  const unsigned = {
    schemaVersion: 1 as const,
    baseContentVersion: "2026.10.11.1",
    baseDatasetVersions: { "lpic-101": 1 },
    changes: [{
      datasetId: "lpic-101",
      operation: "update" as const,
      questionId: after.id,
      baseFingerprint: fingerprint(questions[0]),
      changedFields: ["explanation"],
      before: questions[0],
      after,
    }],
    message: "解説更新",
  };
  const idempotencyKey = await sha256(stableJson(unsigned));
  const command = parseApplyCommand({ ...unsigned, idempotencyKey }, idempotencyKey);
  await verifyIdempotencyKey(command);
  await assert.rejects(verifyIdempotencyKey({ ...command, message: "改ざん" }), /一致/u);
});

test("D1 binding設定は指定値を保持する", () => {
  const config = readFileSync("workers/quiz-content-db/wrangler.toml", "utf8");
  assert.match(config, /binding = "DB"/u);
  assert.match(config, /database_name = "study-quiz-db"/u);
  assert.match(config, /database_id = "e342a769-d2fc-493f-88a7-9aac70f7914c"/u);
});
