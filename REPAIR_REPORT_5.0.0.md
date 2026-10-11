# Study Quiz 5.0.0 D1整合修復報告

検証日: 2026-10-11  
対象: `project_dump_full.txt`を基準にしたD1移行版

## 1. 根本原因

D1移行後の現行契約は`ApplyD1ChangesCommand` / `ApplyD1ChangesResult` / `createApplyD1ChangesCommand`である。一方、ローカル失敗環境には旧GitHub PR契約の次の要素が残っていた。

- `CreateContentPullRequestCommand`
- `CreateContentPullRequestResult`
- `createContentPullRequestCommand`
- `contentPullRequestApi.ts`
- `workerQuizContent.test.ts`
- `workers/quiz-content-pr`

旧`ValidatedCommand`はPR用の`title`、`body`、`commitMessage`を要求し、D1 commandは監査用`message`を要求する。二つを同じ`tsconfig.node.json`の全テスト対象へ残したため、旧テストがD1型・D1差分サービスを旧PR契約として参照し、欠落exportと型22件を発生させた。

これはesbuildのinstall scriptではなく、TypeScriptがVite/esbuildのbundle前に検出した契約混在である。

## 2. D1設計が正である根拠

現行実行経路:

```text
QuestionMasterPage
  → questionMasterChangeService
  → d1ContentApi
  → /api/content/access-session
  → /api/content/changes
  → workers/quiz-content-db
  → binding DB
  → study-quiz-db
```

読取り:

```text
/api/content/snapshot
  → 同梱snapshot
  → IndexedDB verified cache
  → 端末seed
```

旧PR API、PR状態、GitHub App、Git Data API、旧Workerへのruntime import、package script、workflow、tsconfig参照は0件であった。このため旧PR Workerは互換実装を戻さず廃止対象とした。

## 3. 維持した保護

- Access JWT RS256署名、issuer、AUD、iat、nbf、exp。
- `ALLOWED_EMAILS`許可リスト。
- 許可Originとsame-origin popup relay。
- strict CSP、no-store、no-referrer。
- SHA-256冪等キー再計算、`idempotency_keys`。
- content version、dataset version、question fingerprint競合。
- `question_revisions`監査ログ。
- TTL付き`content_write_lock`とD1 batch。
- local-onlyの同期除外、payload除外、Worker拒否。
- D1障害時のoffline fallback。

## 4. D1 schema影響

変更なし。次の2 migrationだけを維持した。

```text
0001_schema.sql
0002_seed_content.sql
```

SQLiteで初回適用と再適用を実行し、100問、content version一致、外部キー違反0を確認した。新規migrationは追加していない。

## 5. 追加・修正・削除

### 追加

- `tests/d1ContentApi.test.ts`
- `tests/d1WorkerHttp.test.ts`
- `docs/d1-cloudflare-setup.md`
- `REPAIR_REPORT_5.0.0.md`

### 主な修正

- `src/services/d1ContentApi.ts`
  - D1結果のcontent version、dataset versions、件数、日時を型ガードで検証。
  - popup応答HTTP statusを100～599で検証。
- `scripts/verify-project.mjs`
  - package scripts、lock版、tsconfig、CI、Wrangler、migration構成を検証。
  - 旧PR Worker/API/型/tokenの再混入を失敗させる。
  - D1 API、Access/JWT、local-only、監査、冪等性、競合、lockを検証。
- `scripts/verify-d1-migrations.py`
  - 初回・再適用の両方を検証。
- `tests/projectStructure.test.ts`
  - 旧PR実装をretired pathとして検証。
- `docs/requirements.md`
- `docs/basic-design.md`
- `docs/detailed-design.md`
- `docs/traceability.md`
- `docs/question-master-authority-assessment.md`
- `docs/question-quality-design.md`
- `README.md`
- `PROJECT_PLAN.md`, `TASKS.md`, `TASK_MANAGEMENT.md`, `PROGRESS.md`, `TEST_REPORT.md`

### 廃止・削除

現行成果物では次を含めない。

- `src/services/contentPullRequestApi.ts`
- `tests/contentPullRequestApi.test.ts`
- `tests/workerQuizContent.test.ts`
- `tests/workerAccessAuth.test.ts`
- `workers/quiz-content-pr/**`
- `docs/github-cloudflare-setup.md`
- `docs/github-integration-assessment.md`
- `docs/github-integration-progress.md`
- `VALIDATION_REPORT_CLOUDFLARE_ACCESS_20261011.md`
- `VALIDATION_REPORT_4.7.0.md`

## 6. ローカル検証結果

|順|コマンド|結果|
|---:|---|---|
|1|`npm run verify:structure`|PASS。D1 100問、旧PR経路0|
|2|`npm run d1:seed:build`|PASS。100問生成|
|3|`npm run d1:migrate:local`|この実行環境ではWrangler取得HTTP 403でBLOCKED|
|3代替|`python3 scripts/verify-d1-migrations.py`|PASS。初回＋再適用、100問、FK違反0|
|4|`npm test`|210/210 PASS、失敗0|
|5|`npm run typecheck`|PASS（取得制約下の一時型runtime）|
|6|`npm run worker:typecheck`|PASS|
|7|`npm run build`|PASS。124 modules|
|8|`npm run test:e2e`|PASS。Chromium実ブラウザー|
|9|`npm run verify:structure`|PASS|
|追加|`npm run check`|PASS|
|追加|TypeScript AST import解決|526件、missing 0|

bundle:

```text
dist/index.html                   1.21 kB
dist/assets/index-DBt-rwVm.css  141.04 kB
dist/assets/index-D2EIP1H2.js   541.37 kB
```

500kB超のchunk warningはあるがbuild失敗ではない。

## 7. npm / esbuild切り分け

- リポジトリに`ignore-scripts`、`onlyBuiltDependencies`、`allowBuild`設定はない。
- lockfileのesbuild `hasInstallScript: true`はパッケージ標準情報。
- 報告された22件は`tsc -b`で発生し、bundle前に停止する旧PR型混在だった。
- セキュリティ設定は変更していない。
- このサンドボックスはVite 7.3.6とWrangler取得がHTTP 403となるため、利用者環境で成功済みの`npm ci`とは分離して記録する。
- 本サンドボックスのbuildは既知の共有Vite/TypeScript runtimeを使用した。成果物へ一時runtimeを含めない。

## 8. 未解決・本番前確認

- 利用者環境のlock依存で`npm ci && npm run check`を再実行する。
- `npm run d1:migrate:local`を再実行し、`No migrations to apply`または正常再適用を確認する。
- `node_modules/.bin/esbuild --version`を確認する。build成功ならinstall script警告は非原因。
- remote D1 export、remote migration、Worker deployは本作業では未実施。
- 本番前にAccess AUD、許可メール、Origin、health、snapshot、popup、検証用1件、監査ログ、offline再起動を確認する。
