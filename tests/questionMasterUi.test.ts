import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const readTree = (directory: string): string =>
  readdirSync(directory, { withFileTypes: true }).map((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? readTree(path) : readFileSync(path, "utf8");
  }).join("\n");

test("D1差分・ローカル専用除外・明示確認画面へ到達できる", () => {
  const app = readFileSync("src/App.tsx", "utf8");
  const page = readFileSync("src/pages/QuestionMasterPage.tsx", "utf8");
  assert.match(app, /QuestionMasterPage/u);
  assert.match(page, /D1反映前の共有変更確認/u);
  assert.match(page, /ローカル専用/u);
  assert.match(page, /変更前/u);
  assert.match(page, /変更後/u);
  assert.match(page, /<ConfirmDialog/u);
  assert.match(page, /Cloudflare Access/u);
});

test("クライアントは公開Worker URL以外のD1・Access秘密情報を保持しない", () => {
  const source = readTree("src");
  assert.doesNotMatch(source, /CF-Access-Client-Secret|database_id\s*=|ACCESS_AUD\s*=/u);
  const api = readFileSync("src/services/d1ContentApi.ts", "utf8");
  assert.match(api, /VITE_QUIZ_CONTENT_API_URL/u);
  assert.match(api, /requestThroughD1AccessSession/u);
  assert.match(api, /window\.open/u);
  assert.match(api, /postMessage/u);
});
