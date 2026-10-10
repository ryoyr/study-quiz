# 検証報告 — 問題品質JSON契約Chrome E2E修正

検証日: 2026-10-11  
対象: Study Quiz 4.7.0

## 1. 基準入力

- 添付`project_dump_full.txt`: 2026-10-11 06:58:19生成、197テキストファイル。
- 197/197をパストラバーサルなしで復元。
- ダンプ外のPWA PNG 4件、tools 3件、Worker 12件の計19件だけを直前検証済み品質向上ZIPから補完。
- ダンプ内197ファイルを優先した。直前品質向上完全版との共通差分は`verify-project.mjs`だけで、最新ダンプを採用した。

## 2. 事象と再現箇所

ユーザー環境の`npm run check`は、build後のChrome E2Eで次のエラーとなった。

```text
問題品質のJSON入力・出力契約を画面で確認できません。
```

旧E2Eは品質向上画面で次を確認していた。

```javascript
[...document.querySelectorAll("button")]
  .some((button) => button.textContent?.includes("対象問題JSONを出力"))
```

品質向上UI拡張後、ボタンは次へ分割・改名された。

```text
現在の分割JSONを出力
選択全体JSONを出力
```

したがって、入力JSONを出力する機能は存在し、品質プロンプトにも出力契約が存在するが、旧表示文言だけを探すE2Eの`input`判定がfalseになっていた。

## 3. 後続の潜在不一致

最初の失敗箇所以降にも、品質向上UI拡張前のDOMへ依存する箇所があった。

- 提案JSON入力: 最初の`textarea:not([readonly])`に依存。
- 前後比較: 本文中の連続した「変更前の解説」「提案後の解説」に依存。
- 状態フィルター: 削除済みの`.correction-filter select`に依存。

これらも現行UIの責務を示す安定識別子へ変更した。

## 4. 修正方針

UIとE2Eの片方だけを旧状態へ戻さず、両方を改善した。

1. 利用者が入力・出力形式を確認できるよう、画面へversion 1のJSON契約を明示する。
2. 表示文言変更に耐えるよう、機能責務へ`data-testid`を付与する。
3. E2Eは入力契約、出力契約、JSON出力可能状態、プロンプト内出力契約を個別に検証する。
4. ファイル取込、JSONテキスト、レビュー前後、状態フィルターも同じ安定契約へ統一する。
5. 品質提案JSON version 1、seed update、保存、適用、既存UI機能は変更しない。

## 5. 変更内容

### 5.1 `QuestionQualityGeneratorPage.tsx`

画面へ次を表示した。

```text
JSON入力契約
  format: study-quiz-question-quality-input
  version: 1

JSON出力契約
  format: study-quiz-question-quality-proposals
  version: 1
```

追加した識別子:

|識別子|対象|
|---|---|
|`quality-input-contract`|入力JSON契約|
|`quality-output-contract`|出力JSON契約|
|`quality-current-batch-json-export`|現在分割JSON出力ボタン|
|`quality-prompt`|品質プロンプト|
|`quality-proposal-file`|提案JSONファイル|
|`quality-proposal-json`|提案JSON入力欄|

### 5.2 `QuestionQualityReviewPage.tsx`

|識別子|対象|
|---|---|
|`quality-before`|変更前の問題・回答・解説|
|`quality-after`|提案後の問題・回答・解説|
|`quality-status-filter`|状態フィルター|

### 5.3 `e2e-accessibility.mjs`

次を直接検証するよう変更した。

- 入力契約に`study-quiz-question-quality-input`がある。
- 出力契約に`study-quiz-question-quality-proposals`がある。
- 現在分割JSONの出力ボタンが有効。
- 品質プロンプトに提案出力契約がある。
- 提案ファイル読込後、指定入力欄へJSONが入る。
- 指定した変更前・提案後領域があり、提案後解説が表示される。
- 状態フィルターをappliedへ変更できる。

### 5.4 テスト・スタイル・文書

- `tests/accessibilityHarness.test.ts`
- `tests/questionQualityPlanningUi.test.ts`
- `src/App.css`
- `docs/question-quality-design.md`
- `TASK_MANAGEMENT.md`
- `CHANGELOG.md`
- `CHANGE_SUMMARY.md`
- `scripts/verify-project.mjs`

## 6. 検証結果

|検証|結果|備考|
|---|---:|---|
|E2E／品質契約静的試験|19/19成功|harness、UI、選択・分割サービス|
|全既存・追加単体試験（補助）|201/201成功|共有tsx＋一時`ts-fsrs`ランタイムadapter|
|Worker strict TypeScript|成功|既存Cloudflare/GitHub互換|
|構成検証|成功|JSON契約と安定識別子を追加検証|
|一時製品相当bundle|成功|Reactを含め、`jsx=automatic`、`ts-fsrs`一時adapter|
|Chrome E2E実走|成功|品質JSON取込・レビュー適用・初期データ更新出力を含む全ジャーニー|

Chrome E2Eの成功メッセージ:

```text
E2E試験に成功しました（3回答方式の登録・回答・履歴・バックアップ往復、品質提案JSON取込・レビュー適用・初期データ更新出力、10画面、10テーマ組合せ、320x568・393x852、主要ナビゲーション、確認ダイアログ、コントラスト、横スクロール複数選択、固定表示、入力エラー、キーボード、AXツリー）。
```

一時bundleと`ts-fsrs`adapterは依存取得不能環境の補助検証専用で、ZIPへ含めていない。正式なVite buildと実`ts-fsrs`を置き換えるものではない。

## 7. 公式npmコマンド再実施

|コマンド|exit|結果|
|---|---:|---|
|`npm ci --no-audit --no-fund`|1|Vite 7.3.6 tarball取得がHTTP 403|
|`npm run typecheck`|1|lock依存未取得。React型、`ts-fsrs`、Vite型を解決不能|
|`npm test`|127|ローカル`tsx`未取得|
|`npm run build`|1|型検査で停止しVite build未到達|
|`npm run check`|127|構成検証成功後、`npm test`で停止|
|`npm run test:e2e`（一時製品相当bundle）|0|実Chromeで全E2E成功|

この環境の失敗は依存取得制約であり、成功扱いにしていない。一方、ユーザー環境で報告されたE2Eの契約不一致は、実Chrome E2Eで修正確認済み。

通常CIでは次を再実行する。

```bash
npm ci --no-audit --no-fund
npm run typecheck
npm test
npm run build
npm run check
```

## 8. 互換性・保全

- 問題データ、問題ID、問題マスターを変更していない。
- 品質入力JSON version 1、品質提案JSON version 1を維持。
- 提案保存、適用、却下、再生成、seed updateを維持。
- 一括ファクトチェック、完全バックアップ、Cloudflare Access、GitHub PR連携を変更していない。
- 実GitHub PR、コミット、main更新は行っていない。

## 9. 成果物整合性

- パッケージ: 217ファイル（`SHA256SUMS_COMPLETE.txt`を含む）。
- 内部SHA-256: 216/216成功。
- ZIP圧縮データ検査: エラー0。
- 展開後SHA-256、構成、静的契約試験、品質関連試験、Worker型検査を再実行する。
