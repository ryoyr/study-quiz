import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string): string => readFileSync(path, "utf8");

test("破壊的操作は共通のアクセシブル確認ダイアログを利用する", () => {
  const dialog = read("src/components/ConfirmDialog.tsx");
  for (const token of [
    'role="alertdialog"',
    'aria-modal="true"',
    "aria-labelledby",
    "aria-describedby",
    'event.key === "Escape"',
    'event.key !== "Tab"',
    "useLayoutEffect",
    "previousFocusRef.current?.focus()",
    'document.body.style.overflow = "hidden"',
    "createPortal",
  ]) {
    assert.match(dialog, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("確認ダイアログの終了処理は描画確定時にフォーカスとスクロールを復旧する", () => {
  const dialog = read("src/components/ConfirmDialog.tsx");
  assert.match(dialog, /useLayoutEffect\(\(\) => \{/);
  assert.match(
    dialog,
    /document\.body\.style\.overflow = previousOverflow;\s+previousFocusRef\.current\?\.focus\(\);/s,
  );
});

test("削除・アーカイブ操作はwindow.confirmへ依存しない", () => {
  const paths = [
    "src/pages/AiPromptTemplatesPage.tsx",
    "src/pages/CorrectionSuggestionsPage.tsx",
    "src/pages/QuestionManagementPage.tsx",
  ];
  for (const path of paths) {
    const source = read(path);
    assert.match(source, /<ConfirmDialog/);
    assert.doesNotMatch(source, /window\.confirm/);
  }
});

test("AIテンプレートカードは入れ子の対話要素を避ける", () => {
  const source = read("src/pages/AiPromptTemplatesPage.tsx");
  assert.match(source, /className="ai-template-select-button"/);
  assert.doesNotMatch(source, /<article[^>]*role="button"/s);
});

test("確認ダイアログは狭幅・強制カラー・セーフエリアへ対応する", () => {
  const css = read("src/App.css");
  assert.match(css, /\.confirm-dialog-backdrop/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /@media \(max-width: 420px\)/);
  assert.match(css, /@media \(forced-colors: active\)/);
  assert.match(css, /min-height: 44px/);
});

test("問題編集はCSV取込と同等の入力上限を適用する", () => {
  const source = read("src/pages/QuestionManagementPage.tsx");
  const validation = read("src/services/questionValidation.ts");
  assert.match(source, /QUESTION_LIMITS/);
  assert.match(source, /questionValidationErrors/);
  assert.match(validation, /id: 200/);
  assert.match(validation, /shortText: 500/);
  assert.match(validation, /longText: 20_000/);
  assert.match(validation, /maxTags: 30/);
});
