import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readJson = (path: string): Record<string, any> =>
  JSON.parse(readFileSync(path, "utf8")) as Record<string, any>;

test("E2Eアクセシビリティ試験をcheckへ統合している", () => {
  const scripts = readJson("package.json").scripts as Record<string, string>;
  assert.equal(scripts["test:e2e"], "node scripts/e2e-accessibility.mjs");
  assert.match(scripts.check, /npm run build && npm run test:e2e$/);
});

test("E2E試験は主要画面・狭幅・フォーカス・AXツリーを検査する", () => {
  const source = readFileSync("scripts/e2e-accessibility.mjs", "utf8");
  for (const token of [
    "Emulation.setDeviceMetricsOverride",
    "width: 320",
    "width: 393",
    "Accessibility.getFullAXTree",
    "Input.dispatchKeyEvent",
    "aria-invalid",
    "scrollWidth",
    "headerScrolledAway",
    "bottomFixed",
    "horizontal-option-scroller",
    "複数選択できません",
    '["学習", "学習"]',
    '["記録", "記録・分析"]',
    '["管理", "問題・教材管理"]',
    '["その他", "その他"]',
  ]) {
    assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("デプロイ前にChromeを準備して全チェックを実行する", () => {
  const workflow = readFileSync(".github/workflows/deploy.yml", "utf8");
  assert.match(workflow, /browser-actions\/setup-chrome@v2/);
  assert.match(workflow, /CHROME_PATH:/);
  assert.match(workflow, /npm run check/);
});

