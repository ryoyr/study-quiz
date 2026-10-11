# Cloudflare D1 / Access セットアップ

## 1. D1 binding

```toml
[[d1_databases]]
binding = "DB"
database_name = "study-quiz-db"
database_id = "e342a769-d2fc-493f-88a7-9aac70f7914c"
migrations_dir = "migrations"
```

## 2. Worker公開変数

`workers/quiz-content-db/wrangler.toml`へ環境固有値を設定する。

```toml
[vars]
ALLOWED_ORIGIN = "https://<static-host-origin>"
ACCESS_TEAM_DOMAIN = "<team>.cloudflareaccess.com"
ACCESS_AUD = "<access-application-aud>"
ALLOWED_EMAILS = "editor1@example.com,editor2@example.com"
ALLOW_LOCAL_WRITE = "false"
```

`ALLOW_LOCAL_WRITE`はlocalhostでの明示的な書込み試験用であり、本番では`false`を維持する。

## 3. Access対象

最低限、次をCloudflare Accessで保護する。

```text
/api/content/access-session
/api/content/changes
```

公開する経路:

```text
/api/content/health
/api/content/snapshot
```

WorkerはAccess通過後もJWT署名、issuer、AUD、iat、nbf、exp、許可メールを再検証する。Bypass EveryoneやAccess Service Tokenのフロント埋込みは行わない。

## 4. ローカル確認

```bash
npm ci --no-audit --no-fund
npm run verify:structure
npm run d1:seed:build
npm run d1:migrate:local
npm run test
npm run typecheck
npm run worker:typecheck
npm run build
npm run test:e2e
npm run verify:structure
```

`wrangler.toml`の`ALLOW_LOCAL_WRITE`を変更せず、読取りとmigrationを確認できる。書込み試験を行う場合だけ、ローカル専用設定ファイルまたは一時的なlocal環境変数で有効化し、本番設定へコミットしない。

## 5. 本番前確認

本番操作はローカル修復の範囲外。実施前に以下を確認する。

1. D1 remote exportを取得。
2. Access ApplicationのAUDとWorker設定が一致。
3. 許可メールが最小範囲。
4. `ALLOWED_ORIGIN`が実際の静的ホストOriginと完全一致。
5. migrationが`0001`と`0002`だけで、既に適用済みなら再適用結果を確認。
6. Worker URLをRepository variable `QUIZ_CONTENT_API_URL`へ設定。
7. health、snapshot、popup、検証用1件、監査ログ、offline再起動を確認。

本成果物はremote migration、Worker deploy、本番データ変更を実行しない。
