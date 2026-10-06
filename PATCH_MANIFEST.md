# Study Quiz v4.4.0 Patch Manifest

- 基準版: 4.3.0 (`project_dump.txt`)
- 対象版: 4.4.0
- 上書き対象: 37ファイル
- 新規追加: 3実装・試験ファイル + 本マニフェスト + SHA256一覧
- 削除対象: なし

## 新規追加

- `src/components/ConfirmDialog.tsx`
- `tests/destructiveActionSafety.test.ts`
- `tests/geminiService.test.ts`
- `PATCH_MANIFEST.md`
- `SHA256SUMS.txt`

## 上書き対象

- `APPLY_UPDATE.md`
- `README.md`
- `UPGRADE_REPORT.md`
- `VALIDATION_REPORT.md`
- `doc/00_全体要件定義.md`
- `doc/00_機能要件/F03_問題管理.md`
- `doc/00_機能要件/F12_問題修正提案・承認.md`
- `doc/00_機能要件/F13_AI学習支援・ファクトチェック.md`
- `doc/00_機能要件/F16_PWA・オフライン・更新管理.md`
- `doc/00_機能要件/F18_品質・エラー処理・アクセシビリティ.md`
- `doc/01_基本設計/BD-F03_問題管理.md`
- `doc/01_基本設計/BD-F12_問題修正提案・承認.md`
- `doc/01_基本設計/BD-F13_AI学習支援・ファクトチェック.md`
- `doc/01_基本設計/BD-F16_PWA・オフライン・更新管理.md`
- `doc/01_基本設計/BD-F18_品質・エラー処理・アクセシビリティ.md`
- `doc/02_詳細設計/DD-F03_問題管理.md`
- `doc/02_詳細設計/DD-F12_問題修正提案・承認.md`
- `doc/02_詳細設計/DD-F13_AI学習支援・ファクトチェック.md`
- `doc/02_詳細設計/DD-F16_PWA・オフライン・更新管理.md`
- `doc/02_詳細設計/DD-F18_品質・エラー処理・アクセシビリティ.md`
- `doc/04_ファイル項目定義/FL04_ServiceWorkerキャッシュ.md`
- `doc/04_ファイル項目定義/FL05_環境・ビルド設定.md`
- `doc/05_管理資料/01_要件設計トレーサビリティ.md`
- `doc/05_管理資料/02_設計網羅性チェックリスト.md`
- `package-lock.json`
- `package.json`
- `public/sw.js`
- `scripts/e2e-accessibility.mjs`
- `scripts/verify-project.mjs`
- `src/App.css`
- `src/pages/AiPromptTemplatesPage.tsx`
- `src/pages/CorrectionSuggestionsPage.tsx`
- `src/pages/QuestionManagementPage.tsx`
- `src/services/fullBackupService.ts`
- `src/services/geminiService.ts`
- `tests/accessibilityHarness.test.ts`
- `tests/pwaAssets.test.ts`

## ZIPへ含めないもの

- `node_modules`、`dist`、`coverage`、`.vite`、`*.tsbuildinfo`、ログ
- 受領した`project_dump.txt`
- 変更していない既存ファイル
- ダンプで内容が省略されていた既存Manifest・PNGアイコン（作業検証用に再構成したが、既存デザインを保つためパッチ対象外）

## 整合性確認

`SHA256SUMS.txt`は同ファイル自身を除くZIP内全ファイルのSHA-256を収録する。
