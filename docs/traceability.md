# Study Quiz 5.0.0 要件トレーサビリティ

|要件|主実装|主検証|
|---|---|---|
|D1を共有正本にする|`QUESTION_MASTER_AUTHORITY`, `workers/quiz-content-db`|`questionMasterDbPreparation.test.ts`, `verify-project.mjs`|
|公開snapshot API|Worker `index.ts`, `repository.ts`|`d1WorkerHttp.test.ts`, `d1ContentApi.test.ts`|
|offline fallback|`questionMasterService.ts`, IndexedDB, `public/content`|`questionMasterService.test.ts`, `questionMasterDbPreparation.test.ts`, E2E|
|端末編集保護|`planQuestionMasterMerge`|`questionMasterService.test.ts`|
|local-only新規既定|問題管理、CSV、類似問題|`questionStorage.test.ts`, `importAndBackup.test.ts`, `similarQuestionService.test.ts`|
|local-only送信禁止|`questionMasterChangeService.ts`, Worker `validation.ts`|`questionMasterChangeService.test.ts`, `d1Worker.test.ts`, `d1WorkerHttp.test.ts`|
|送信前差分・確認|`QuestionMasterPage.tsx`, `ConfirmDialog.tsx`|`questionMasterUi.test.ts`, E2E|
|Access popup relay|`d1ContentApi.ts`, Worker `http.ts`|`d1ContentApi.test.ts`, `d1WorkerHttp.test.ts`|
|Access JWT署名・issuer・AUD・期限|Worker `auth.ts`|`d1AccessAuth.test.ts`|
|許可メール|Worker `auth.ts`|`d1AccessAuth.test.ts`|
|Origin/CORS|Worker `http.ts`, `index.ts`|`d1WorkerHttp.test.ts`|
|冪等キー|`createApplyD1ChangesCommand`, Worker `verifyIdempotencyKey`, `idempotency_keys`|`questionMasterChangeService.test.ts`, `d1Worker.test.ts`|
|content/dataset競合|Worker `repository.ts`|構成検証、ローカルD1統合確認|
|問題fingerprint競合|Worker `repository.ts`|`d1Worker.test.ts`, 構成検証|
|監査ログ|`question_revisions`とWorker batch|migration検証、構成検証|
|書込み排他|`content_write_lock`|migration検証、構成検証|
|D1 seed 100問|seed生成script、`0002_seed_content.sql`|`verify-d1-migrations.py`, `lpicSeedAndCalendar.test.ts`|
|旧GitHub PR経路排除|retired path検証、現行package/CI|`verify-project.mjs`, `projectStructure.test.ts`|
|アプリstrict型|`tsconfig.app.json`, `tsconfig.node.json`|`npm run typecheck`|
|Worker strict型|Worker `tsconfig.json`|`npm run worker:typecheck`|
|本番bundle|Vite|`npm run build`|
|PWA・アクセシビリティ|manifest、SW v25、UI|`pwaAssets.test.ts`, `themeAccessibility.test.ts`, E2E|

## 廃止対象

以下は5.0.0の要件・実行経路ではない。

- `CreateContentPullRequestCommand`
- `CreateContentPullRequestResult`
- `createContentPullRequestCommand`
- `contentPullRequestApi.ts`
- `workers/quiz-content-pr`
- PR作成・状態取得テスト

互換型や空実装で残さず、構成検証で再混入を失敗させる。
