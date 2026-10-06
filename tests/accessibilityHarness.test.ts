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
    "headerFixed",
    "bottomFixed",
    "horizontal-option-scroller",
    "storage-health-badge",
    "storage-persistence-heading",
    "?screen=backupCenter",
    "複数選択できません",
    '["学習", "学習"]',
    '["記録", "記録・分析"]',
    '["管理", "問題・教材管理"]',
    '["その他", "その他"]',
  ]) {
    assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.ok(
    source.indexOf("await findBrowser()") <
      source.indexOf("await startStaticServer()"),
    "ブラウザー確認より先に試験サーバーを起動してはいけません",
  );
});

test("デプロイ前にChromeを準備して全チェックを実行する", () => {
  const workflow = readFileSync(".github/workflows/deploy.yml", "utf8");
  assert.match(workflow, /browser-actions\/setup-chrome@v2/);
  assert.match(workflow, /CHROME_PATH:/);
  assert.match(workflow, /npm run check/);
});



test("複数タブ競合通知は読み上げ可能で再読込操作へフォーカス誘導する", () => {
  const source = readFileSync("src/components/ConcurrentUpdateNotice.tsx", "utf8");
  assert.match(source, /role="alertdialog"/);
  assert.match(source, /aria-labelledby="concurrent-update-title"/);
  assert.match(source, /headingRef\.current\?\.focus/);
  assert.match(source, /最新データを読み込む/);
});

test("バックアップ復元は差分確認と明示チェック後にだけ実行できる", () => {
  const source = readFileSync("src/pages/BackupCenterPage.tsx", "utf8");
  assert.match(source, /compareFullBackup/);
  assert.match(source, /現在データとの差分集計/);
  assert.match(source, /type="checkbox"/);
  assert.match(source, /!restoreAcknowledged/);
  assert.match(source, /study-quiz-pre-restore/);
  assert.doesNotMatch(source, /window\.confirm/);
});
