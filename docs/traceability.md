# 要件トレーサビリティ — 4.5.1

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
|FR-10 PWA|manifest、`sw.js`、PNG 4件、生成ツール|`pwaAssets.test.ts`, `verify-project.mjs`|4.5.1 cache v21|
|NFR-01 互換性|回答アダプター、migration、backup|`configurationContract.test.ts`, `resilience.test.ts`|維持|
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
