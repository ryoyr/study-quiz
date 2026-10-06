
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const retiredFiles = [
  "src/components/BottomNavigation.tsx",
  "src/pages/GeminiSettingsSection.tsx",
  "src/pages/HomePage.tsx",
  "src/pages/QuizPage.tsx",
  "src/pages/SetupPage.tsx",
  "src/services/backupService.ts",
  "src/services/setupFlow.ts",
  "src/services/sessionService.ts",
  "src/services/studyPlanService.ts",
  "src/types/AppScreen.ts",
  "src/types/Session.ts",
  "src/ui-enhancement.css",
  "public/favicon.svg",
  "public/icons.svg",
  "eslint.config.js",
];

const retiredDirectories = ["src/major", "src/enhancements", "src/assets"];

test("ビルドに必要な設定ファイルが揃っている", () => {
  for (const path of [
    "tsconfig.json",
    "tsconfig.app.json",
    "tsconfig.node.json",
    "vite.config.ts",
  ]) {
    assert.equal(existsSync(path), true, `${path} がありません`);
  }
  const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
    scripts?: Record<string, string>;
  };
  assert.equal(typeof packageJson.scripts?.["verify:structure"], "string");
  assert.equal(typeof packageJson.scripts?.check, "string");
  assert.ok(packageJson.scripts);
  assert.equal(packageJson.scripts.build, "tsc -b && vite build");
  assert.equal(typeof packageJson.scripts?.build, "string");
});

test("統合済みの旧画面・重複サービス・未参照資材が残っていない", () => {
  for (const path of [...retiredFiles, ...retiredDirectories]) {
    assert.equal(existsSync(path), false, `${path} は削除対象です`);
  }
});

test("Gemini連携は利用者操作で送信し、HTML直接挿入を含まない", () => {
  const sources =
    readFileSync("src/App.tsx", "utf8") +
    readFileSync("src/components/AiQuestionPanel.tsx", "utf8") +
    readFileSync("src/components/GlobalAiChat.tsx", "utf8") +
    readFileSync("src/components/GeminiSettingsSection.tsx", "utf8") +
    readFileSync("src/pages/AiPromptTemplatesPage.tsx", "utf8") +
    readFileSync("src/pages/SimilarQuestionGeneratorPage.tsx", "utf8");
  const service = readFileSync("src/services/geminiService.ts", "utf8");
  assert.doesNotMatch(sources, /dangerouslySetInnerHTML/);
  assert.match(service, /generativelanguage\.googleapis\.com/);
  assert.match(service, /x-goog-api-key/);
  assert.match(sources, /Geminiへ送信|AIへ送信/);
});

test("PWA更新通知と共通エラー境界をアプリルートへ接続している", () => {
  const main = readFileSync("src/main.tsx", "utf8");
  assert.match(main, /<ErrorBoundary>/);
  assert.match(main, /<PwaUpdatePrompt\s*\/>/);
});

test("類似問題生成を管理画面へ統合している", () => {
  const app = readFileSync("src/App.tsx", "utf8");
  assert.match(app, /SimilarQuestionGeneratorPage/);
  assert.match(app, /setScreen\("similarQuestion"\)/);
});
