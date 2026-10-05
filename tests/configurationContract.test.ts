import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readJson = (path: string): Record<string, any> =>
  JSON.parse(readFileSync(path, "utf8")) as Record<string, any>;

test("TypeScriptのルート構成はappとnodeを参照する", () => {
  const root = readJson("tsconfig.json");
  assert.deepEqual(root.references, [
    { path: "./tsconfig.app.json" },
    { path: "./tsconfig.node.json" },
  ]);
});

test("appとnodeの型検査はstrict・noEmit・Bundler解決を使う", () => {
  for (const path of ["tsconfig.app.json", "tsconfig.node.json"]) {
    const config = readJson(path);
    assert.equal(config.compilerOptions.strict, true, path);
    assert.equal(config.compilerOptions.noEmit, true, path);
    assert.equal(config.compilerOptions.moduleResolution, "Bundler", path);
  }
  assert.equal(readJson("tsconfig.app.json").compilerOptions.jsx, "react-jsx");
});

test("checkは構成検証・単体試験・ビルド・E2Eを順に実行する", () => {
  const scripts = readJson("package.json").scripts as Record<string, string>;
  assert.equal(scripts["verify:structure"], "node scripts/verify-project.mjs");
  assert.equal(scripts["test:e2e"], "node scripts/e2e-accessibility.mjs");
  assert.equal(
    scripts.check,
    "npm run verify:structure && npm run test && npm run build && npm run test:e2e",
  );
});

test("CIはロックファイルに基づく再現可能な依存関係を使う", () => {
  const workflow = readFileSync(".github/workflows/deploy.yml", "utf8");
  assert.match(workflow, /cache:\s*npm/);
  assert.match(workflow, /npm ci --no-audit --no-fund/);
  assert.doesNotMatch(workflow, /npm install --no-audit --no-fund/);
});

test("アプリ版・ロックファイル・バックアップ版の表示が一致する", () => {
  const packageJson = readJson("package.json");
  const packageLock = readJson("package-lock.json");
  const backupService = readFileSync(
    "src/services/fullBackupService.ts",
    "utf8",
  );
  assert.equal(packageLock.version, packageJson.version);
  assert.equal(packageLock.packages[""].version, packageJson.version);
  assert.match(
    backupService,
    new RegExp(`const APP_VERSION = ["']${packageJson.version}["']`),
  );
});
