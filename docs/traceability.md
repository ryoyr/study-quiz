# 要件トレーサビリティ — 4.6.0

|要件|主実装|主検証|状態|
|---|---|---|---|
|FR-01 初回設定|`InitialSetupPage.tsx`, `setupValidation.ts`, `setupStorage.ts`|`setupValidation.test.ts`, `examScopeSchema.test.ts`|実装済み|
|FR-02 問題管理|`QuestionManagementPage.tsx`, `questionStorage.ts`, `questionValidation.ts`|`questionStorage.test.ts`, `questionValidation.test.ts`|実装済み|
|FR-03 回答定義・採点|`questionAnswerModel.ts`, `questionAnswerService.ts`, `App.tsx`|`questionAnswerService.test.ts`, `answerTypeIntegration.test.ts`|4.5.0改良|
|FR-04 CSV|`CsvImportPage.tsx`, `csvImportService.ts`|`importAndBackup.test.ts`|実装済み|
|FR-05 学習セッション|`sessionGenerator.ts`, `studySelectionService.ts`, `activeSessionStorage.ts`|`sessionGenerator.test.ts`, `studySelectionAndTrend.test.ts`, `resilience.test.ts`|実装済み|
|FR-06 履歴・復習・分析|`StudyHistory.ts`, `questionAnswerModel.ts`, `historyStorage.ts`, `LearningHistoryPage.tsx`, `questionStateService.ts`|`questionAnswerService.test.ts`, `historyStorage.test.ts`, `importAndBackup.test.ts`, Chrome E2E, 分析系test|4.5.1スナップショット対応|
|FR-07 教材・AI補助|`promptBuilder.ts`, `AiQuestionPanel.tsx`, `similarQuestionService.ts`, `batchFactCheckService.ts`|`answerTypeIntegration.test.ts`, `similarQuestionService.test.ts`, `projectStructure.test.ts`|4.5.0改良|
|FR-08 保存|`storageTransaction.ts`, `verifiedStorage.ts`, `storageSynchronization.ts`|`storageTransaction.test.ts`, `storageSynchronization.test.ts`|実装済み|
|FR-09 完全バックアップ|`fullBackupService.ts`, `BackupCenterPage.tsx`|`resilience.test.ts`, `importAndBackup.test.ts`|実装済み|
|FR-10 PWA|manifest、`sw.js`、PNG 4件、生成ツール|`pwaAssets.test.ts`, `verify-project.mjs`|4.6.0 cache v22|
|FR-11 問題・解説品質向上|`questionQualityService.ts`, `questionQualityProposalStorage.ts`, 品質生成・レビュー画面, seed update tool|`questionQualityService.test.ts`, `questionSeedUpdateTool.test.ts`, Chrome E2E|4.6.0実装|
|NFR-01 互換性|回答アダプター、migration schema 9、backup 10|`configurationContract.test.ts`, `resilience.test.ts`, `questionQualityService.test.ts`|version 2～10読込み|
|NFR-02 品質|package scripts、CI、構成/E2E scripts|全単体、構文変換、型検査|通常CI最終ゲートあり|
|NFR-03 アクセシビリティ|`ConfirmDialog.tsx`, `App.css`, E2E script|`accessibilityHarness.test.ts`, `themeAccessibility.test.ts`|自動試験実装済み|
|NFR-04 セキュリティ|保存・外部連携境界|`projectStructure.test.ts`, 静的監査|新規自動外部送信なし|

## 未実装追跡

|候補|要求化|設計|実装|試験|
|---|---|---|---|---|
|問題revision|候補|未|未|未|
|部分点・数値許容差等|候補|内部モデルに拡張点|未|未|
|CSVエクスポート・一括更新|候補|未|未|未|
|IndexedDB正本化|候補|未|未|未|
|認証・同期|範囲外|未|未|未|
|暗号化・署名バックアップ|候補|未|未|未|
|3方式の実ブラウザーE2E|P1|済|済|Chromeで2回連続成功|

## 4.7.0 問題マスターGitHub連携

|要件|設計・実装|検証|
|---|---|---|
|現行問題形式・ID・学習データ互換|`public/content/**`, `questionMasterService`, storage schema 9 / backup 10維持|`questionMasterService.test.ts`, 既存questionStorage/history/PWA試験|
|送信前の追加・更新・アーカイブ差分|`questionMasterChangeService`, `QuestionMasterPage`|`questionMasterChangeService.test.ts`, `questionMasterUi.test.ts`|
|明示操作時だけPR作成|`QuestionMasterPage` + `ConfirmDialog`|`questionMasterUi.test.ts`|
|秘密情報をクライアントへ置かない|`contentPullRequestApi`, Workers Secrets|`questionMasterUi.test.ts`, `workerAccessAuth.test.ts`|
|Access認証・利用者認可・CORS・Rate Limit|Worker `auth.ts`, `http.ts`, `index.ts`|`workerAccessAuth.test.ts`, `workerQuizContent.test.ts`|
|クロスサイトCookie非依存のAccess連携|`contentPullRequestApi.ts`、`QuestionMasterPage.tsx`、Worker access-session relay|`contentPullRequestApi.test.ts`, `questionMasterUi.test.ts`, `workerQuizContent.test.ts`|
|許可リポジトリ・ブランチ・パス固定|Worker env + command strict validation|`workerQuizContent.test.ts`, `questionMasterUi.test.ts`|
|最新版・問題単位競合検出|manifest version、base SHA、question fingerprint|`questionMasterService.test.ts`, `workerQuizContent.test.ts`|
|複数ファイルを1コミット|GitHub blobs/tree/commit/ref|`workerQuizContent.test.ts`|
|main直接更新・自動マージ禁止|専用`quiz-content/*` ref、PR createのみ|`questionMasterUi.test.ts`|
|再送の重複防止|SHA-256冪等キー、決定的ブランチ、既存PR回収|`questionMasterChangeService.test.ts`, `workerQuizContent.test.ts`|
|マージ後の安全同期・オフライン維持|安全マージ、SW network-first→cache fallback|`questionMasterService.test.ts`, `pwaAssets.test.ts`|
|設定・運用・費用|`github-cloudflare-setup.md`|文書レビュー、本番接続は設定後|
