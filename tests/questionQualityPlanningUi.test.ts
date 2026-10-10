import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("品質向上画面は選択ロジック・件数・対象問題・分割を利用者へ提示する", () => {
  const source = readFileSync(
    "src/pages/QuestionQualityGeneratorPage.tsx",
    "utf8",
  );
  for (const token of [
    "対象問題の選択ロジック",
    "カテゴリ",
    "難易度",
    "回答方式",
    "出典",
    "対象件数・対象問題を確認",
    "未確認の品質提案がある問題を除外する",
    "品質維持の分割単位",
    "現在の分割プロンプトをコピー",
    "JSON入力契約",
    "JSON出力契約",
    "quality-input-contract",
    "quality-output-contract",
    "quality-current-batch-json-export",
    "quality-prompt",
    "quality-proposal-json",
    "表示分をすべて選択",
    "次の",
  ]) {
    assert.match(source, new RegExp(token, "u"));
  }
  assert.match(source, /planQuestionQualitySelection/u);
  assert.match(source, /createQuestionQualityBatches/u);
  assert.doesNotMatch(source, /\.slice\(0, limit\)/u);
});

test("品質レビューは回答定義・解説・出典を比較し再生成できる", () => {
  const source = readFileSync(
    "src/pages/QuestionQualityReviewPage.tsx",
    "utf8",
  );
  for (const token of [
    "変更前",
    "提案後",
    "選択肢",
    "正答",
    "解説",
    "出典",
    "難易度",
    "却下して再生成プロンプトをコピー",
    "buildQuestionQualityRegenerationPrompt",
    "quality-before",
    "quality-after",
    "quality-status-filter",
    "レビュー済みとして適用",
  ]) {
    assert.match(source, new RegExp(token, "u"));
  }
});

test("品質提案JSON・seed updateの既存version 1契約を維持する", () => {
  const service = readFileSync("src/services/questionQualityService.ts", "utf8");
  const types = readFileSync("src/types/QuestionQualityProposal.ts", "utf8");
  assert.match(service, /study-quiz-question-quality-input/u);
  assert.match(service, /study-quiz-question-quality-proposals/u);
  assert.match(service, /study-quiz-question-seed-updates/u);
  assert.match(service, /version:\s*1\s+as const/u);
  assert.match(types, /version:\s*1/u);
  assert.match(types, /pending.*applied.*rejected/u);
});
