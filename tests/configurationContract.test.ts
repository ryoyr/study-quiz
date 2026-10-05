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

test("checkは構成検証・単体試験・ビルドを順に実行する", () => {
  const scripts = readJson("package.json").scripts as Record<string, string>;
  assert.equal(scripts["verify:structure"], "node scripts/verify-project.mjs");
  assert.equal(
    scripts.check,
    "npm run verify:structure && npm run test && npm run build",
  );
});
