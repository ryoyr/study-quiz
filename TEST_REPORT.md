# TEST REPORT — Study Quiz 5.0.0 D1整合修復

検証日: 2026-10-11

|検証|結果|詳細|
|---|---:|---|
|構成検証|PASS|D1 100問、旧PR経路0、Access/JWT、local-only、offline/PWA|
|D1 seed生成|PASS|100問|
|Wrangler local migration|BLOCKED|サンドボックスのpackage feedがWrangler取得をHTTP 403で拒否|
|SQLite migration初回・再適用|PASS|100問、content version一致、FK違反0|
|単体試験|210/210 PASS|失敗0|
|アプリ・テストTypeScript|PASS（代替runtime）|`tsc -b`|
|D1 Worker strict TypeScript|PASS|`tsc -p workers/quiz-content-db/tsconfig.json`|
|本番build|PASS（共有Vite runtime）|124 modules、JS 541.37kB、CSS 141.04kB|
|Chromium E2E|PASS|3回答方式、履歴、backup、品質提案、10画面、10テーマ、狭幅、AX tree|
|統合check|PASS|構成、seed、210 tests、型、Worker型、build、E2E|
|TypeScript import graph|PASS|相対import 526、missing 0|

## npm・esbuild

本サンドボックスの`npm ci`はVite 7.3.6取得HTTP 403で停止した。リポジトリにinstall scriptを禁止する設定はなく、esbuild警告を解消するためのセキュリティ緩和は行っていない。元の22件は旧PR契約のTypeScriptエラーであり、esbuild実行前の失敗である。

## 制約

- 利用者環境ではnpm ci成功済み。修正版で公式lock依存の`npm run check`再実行が必要。
- remote migration、Worker deploy、本番データ変更は未実施。
- buildのchunk size warningは残るが、エラーではない。

詳細は`REPAIR_REPORT_5.0.0.md`を参照。
