import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("D1を共有正本、IndexedDB v3を派生cacheとする", () => {
  const database = readFileSync("src/infrastructure/db/database.ts", "utf8");
  const master = readFileSync("src/services/questionMasterService.ts", "utf8");
  assert.match(database, /DATABASE_VERSION = 3/u);
  assert.match(database, /questionMasterCache/u);
  assert.match(master, /QUESTION_MASTER_AUTHORITY = "cloudflare-d1"/u);
  assert.match(master, /fetchD1QuestionMasterValue/u);
  assert.match(master, /bundled-snapshot/u);
  assert.match(master, /indexeddb-cache/u);
});

test("Service Worker v25は同梱snapshotをnetwork-firstにする", () => {
  const source = readFileSync("public/sw.js", "utf8");
  assert.match(source, /CACHE_NAME = `\$\{CACHE_PREFIX\}v25`/u);
  assert.match(source, /networkFirstContent/u);
  assert.match(source, /CLEAR_CONTENT_CACHE/u);
});
