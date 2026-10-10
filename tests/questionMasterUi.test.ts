import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const readTree = (directory: string): string =>
  readdirSync(directory, { withFileTypes: true })
    .map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? readTree(path) : readFileSync(path, "utf8");
    })
    .join("\n");

test("問題管理から送信前差分・明示確認・PR状態画面へ到達できる", () => {
  const app = readFileSync("src/App.tsx", "utf8");
  const page = readFileSync("src/pages/QuestionMasterPage.tsx", "utf8");
  assert.match(app, /QuestionMasterPage/);
  assert.match(app, /setScreen\("questionMaster"\)/);
  assert.match(page, /GitHub送信前の変更確認/);
  assert.match(page, /変更前/);
  assert.match(page, /変更後/);
  assert.match(page, /<ConfirmDialog/);
  assert.match(page, /メインブランチへ直接コミットせず/);
  assert.match(page, /GitHubでPull Requestを開く/);
  assert.match(page, /マージ済み/);
});

test("クライアントはWorkers URL以外のGitHub秘密情報を保持しない", () => {
  const source = readTree("src");
  assert.doesNotMatch(source, /GITHUB_PRIVATE_KEY|GITHUB_INSTALLATION_ID|BEGIN RSA PRIVATE KEY/);
  const api = readFileSync("src/services/contentPullRequestApi.ts", "utf8");
  assert.match(api, /VITE_QUIZ_CONTENT_API_URL/);
  assert.match(api, /type\s+ContentApiImportMeta\s*=\s*ImportMeta\s*&/);
  assert.match(api, /import\.meta\s+as\s+ContentApiImportMeta/);
  assert.doesNotMatch(api, /interface\s+ViteImportMeta\s+extends\s+ImportMeta/);
  assert.match(api, /credentials: "include"/);
  assert.match(api, /requestThroughContentAccessSession/);
  assert.match(api, /window\.open/);
  assert.match(api, /postMessage/);
  assert.doesNotMatch(api, /CF-Access-Client-Secret|GITHUB_PRIVATE_KEY|GITHUB_INSTALLATION_ID/);
  assert.doesNotMatch(api, /localStorage|sessionStorage|indexedDB/iu);
});

test("Workersは固定設定の専用ブランチとPRだけを作りmain更新・自動マージを行わない", () => {
  const worker = readTree("workers/quiz-content-pr/src");
  assert.match(worker, /GITHUB_OWNER/);
  assert.match(worker, /GITHUB_BASE_BRANCH/);
  assert.match(worker, /GITHUB_CONTENT_ROOT/);
  assert.match(worker, /refs\/heads\/\$\{input\.branch\}/);
  assert.doesNotMatch(worker, /mergePullRequest|\/merges|PATCH[\s\S]{0,80}git\/refs/);
});
