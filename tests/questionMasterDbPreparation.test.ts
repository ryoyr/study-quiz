import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("IndexedDB v3は派生問題マスターキャッシュだけを追加する", () => {
  const source = readFileSync("src/infrastructure/db/database.ts", "utf8");
  assert.match(source, /DATABASE_VERSION = 3/u);
  assert.match(source, /questionMasterCache/u);
  assert.match(source, /readQuestionMasterCacheRecord/u);
  assert.match(source, /writeQuestionMasterCacheRecord/u);
  assert.doesNotMatch(source, /questions.*createObjectStore/u);
});

test("問題マスターはGitHub配布を正本とし検証済みDBキャッシュへfallbackする", () => {
  const source = readFileSync("src/services/questionMasterService.ts", "utf8");
  assert.match(source, /fetchRemoteQuestionMaster/u);
  assert.match(source, /parseCachedQuestionMaster/u);
  assert.match(source, /writeQuestionMasterCacheRecord/u);
  assert.match(source, /readQuestionMasterCacheRecord/u);
  assert.match(source, /throw networkError/u);
});

test("Service Worker v24は問題マスターをnetwork-firstにし明示消去を受け付ける", () => {
  const source = readFileSync("public/sw.js", "utf8");
  assert.match(source, /CACHE_NAME = `\$\{CACHE_PREFIX\}v24`/u);
  assert.match(source, /networkFirstContent/u);
  assert.match(source, /cache: "no-cache"/u);
  assert.match(source, /CLEAR_CONTENT_CACHE/u);
  assert.match(source, /Content fetch failed/u);
});
