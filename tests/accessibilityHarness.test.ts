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
    "アーカイブ確認ダイアログ",
    "safeFocus",
    "scrollLocked",
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

test("E2E試験は3回答方式を登録・回答・履歴表示・バックアップ往復する", () => {
  const source = readFileSync("scripts/e2e-accessibility.mjs", "utf8");
  for (const token of [
    "runAnswerModeJourney",
    "answer-modes.csv",
    "E2E-SINGLE",
    "E2E-MULTIPLE",
    "E2E-TEXT",
    "正常・警告行を登録（3件）",
    "E2E 択一問題",
    "E2E 複数選択問題",
    "E2E 入力問題",
    "study-quiz-answer-history-v1",
    "questionSnapshot",
    "問題編集後に回答時点スナップショットを表示できません",
    "study-quiz-full-backup-",
    "answer-modes-backup.json",
    "Browser.setDownloadBehavior",
    "3方式バックアップの復元完了",
  ]) {
    assert.match(
      source,
      new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  }
  assert.ok(
    source.indexOf('"CSVから一括登録"') <
      source.indexOf('"学習計画を確認して開始"'),
    "3方式の登録より先に学習を開始してはいけません",
  );
  assert.ok(
    source.indexOf('"完全バックアップを出力"') <
      source.indexOf('"確認した内容で復元"'),
    "バックアップ出力より先に復元してはいけません",
  );
});

test("E2E試験は品質提案のJSON取込・レビュー適用・初期データ出力を行う", () => {
  const source = readFileSync("scripts/e2e-accessibility.mjs", "utf8");
  for (const token of [
    "runQuestionQualityJourney",
    "study-quiz-question-quality-proposals",
    "変更前の解説",
    "提案後の解説",
    "レビュー済みとして適用",
    "study-quiz-question-quality-proposals-v1",
    "study-quiz-question-seed-updates-",
    "適用済み品質提案を初期データ更新JSONへ出力できません",
  ]) {
    assert.match(
      source,
      new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  }
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

test("共通確認ダイアログはキーボード操作とフォーカス復帰を実装する", () => {
  const source = readFileSync("src/components/ConfirmDialog.tsx", "utf8");
  assert.match(source, /role="alertdialog"/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /cancelButtonRef\.current\?\.focus/);
  assert.match(source, /previousFocusRef\.current\?\.focus/);
  assert.match(source, /event\.key === "Escape"/);
  assert.match(source, /event\.key !== "Tab"/);
});

test("初期化失敗時は保存操作を止め、非同期読込後の破棄済み更新を防ぐ", () => {
  const source = readFileSync("src/App.tsx", "utf8");
  assert.match(source, /setStorageBlocked\(true\)/);
  assert.match(source, /if \(storageBlocked\)/);
  assert.match(source, /const loadedExamScopes = await readExamScopes\(\)/);
  assert.match(source, /if \(cancelled\) return;\s*setExamScopes\(loadedExamScopes\)/s);
});

test("PWA更新確認とインストール失敗を未処理Promiseにしない", () => {
  const source = readFileSync("src/components/PwaUpdatePrompt.tsx", "utf8");
  assert.match(source, /registration\.update\(\)\.catch/);
  assert.match(source, /await prompt\.prompt\(\)/);
  assert.match(source, /catch \{\s*setNotice\("error"\)/s);
});

test("狭幅画面では固定ヘッダーとバックアップ差分一覧を画面幅内へ収める", () => {
  const css = readFileSync("src/App.css", "utf8");
  assert.match(css, /\.app-frame \.app-shell\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\)/s);
  assert.match(css, /\.app-status-bar\s*\{[^}]*max-width: 100vw[^}]*overflow-x: clip/s);
  assert.match(css, /\.backup-preview-list\s*\{\s*display: block !important;/s);
  assert.doesNotMatch(css, /\.backup-preview > div\s*\{/);
});

