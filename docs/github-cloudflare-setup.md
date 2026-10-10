# GitHub App／Cloudflare Workers 設定・運用手順

## 1. アーキテクチャ

```text
Study Quiz PWA (GitHub Pages)
  ├─ 問題編集・端末内保存（既存localStorage）
  ├─ public/content の最新版取得
  └─ 明示送信
       ↓ HTTPS + Cloudflare Access cookie
Cloudflare Workers
  ├─ Access JWT署名/AUD/利用者、CORS、Rate Limit、入力を検証
  ├─ 許可リポジトリ・main・public/contentを固定
  └─ GitHub App installation token（短命）
       ↓ GitHub REST API
GitHub
  ├─ blobs → tree → commit → refs/heads/quiz-content/...
  └─ Pull Request → 人が確認してmainへマージ
```

アプリやWorkersからmainを更新するAPI、自動マージAPIは呼び出さない。

## 2. GitHub App

### 2.1 作成

1. GitHubの **Settings > Developer settings > GitHub Apps > New GitHub App** を開く。
2. GitHub App name、Homepage URLを設定する。
3. Webhookを使わない場合は **Active** を解除する。
4. Repository permissionsを次だけ設定する。
   - **Contents: Read and write** — 問題JSON、manifest、ブランチ、コミット
   - **Pull requests: Read and write** — PR作成・状態確認
   - **Metadata: Read-only** — 既定の必須権限
5. `Where can this GitHub App be installed?` は運用主体に限定する。
6. 作成後にprivate keyを1つ生成し、安全な端末へ一時保存する。
7. **Install App** から `Only select repositories` を選び、対象リポジトリだけへインストールする。
8. App IDとinstallation IDを控える。installation IDはインストール設定URLの数値部分で確認する。

付与しない権限: Administration、Actions write、Members、Secrets、Workflows。実装はこれらを使用しない。

### 2.2 main保護

対象リポジトリの **Settings > Rules > Rulesets** でmainに次を推奨する。

- Require a pull request before merging
- Require status checks to pass: Pagesワークフローの`npm run check`
- Require approvals: 個人運用なら任意、複数管理者なら1件以上推奨
- Block force pushes
- Restrict deletions
- 必要ならRequire conversation resolution

GitHub Appにruleset bypassを付けない。

## 3. Cloudflare Access

1. Workers用のカスタムホスト名（例 `quiz-content-api.example.com`）を用意する。
2. Zero Trust > Access controls > ApplicationsでSelf-hosted applicationを作成し、Workersのホスト名／APIパスを保護する。
3. 許可するIdP・利用者だけをAccess policyのAllowへ追加する。
4. Application Audience (AUD) Tagを控える。
5. Workersの`ACCESS_TEAM_DOMAIN`へ `<team>.cloudflareaccess.com`、`ACCESS_AUD`へAUDを設定する。
6. `ALLOWED_EMAILS`にも書込み可能なメールを列挙する。Accessへログインできても、この一覧にない利用者は403となる。

重要:

- `workers_dev = false`を維持し、Accessを迂回できる`*.workers.dev`公開URLを残さない。
- Workers自身も`Cf-Access-Jwt-Assertion`を外部公開JWKで検証する。
- CORSは認証の代わりではない。`ALLOWED_ORIGIN`はGitHub Pagesのオリジンと完全一致させる（末尾パス・スラッシュなし）。

## 4. Workersデプロイ

### 4.1 準備

`workers/quiz-content-pr/wrangler.toml.example`を`wrangler.toml`へコピーし、秘密でない固定値を置換する。

```bash
cd workers/quiz-content-pr && cp wrangler.toml.example wrangler.toml && npm install
```

初回`npm install`で作成された`package-lock.json`はレビューしてコミットし、以後は`npm ci`を使用する。

### 4.2 Secrets

各コマンドは対話入力。値をコマンドライン引数、シェル履歴、`.dev.vars`、Gitへ書かない。

```bash
cd workers/quiz-content-pr && npx wrangler secret put GITHUB_APP_ID
```

```bash
cd workers/quiz-content-pr && npx wrangler secret put GITHUB_INSTALLATION_ID
```

```bash
cd workers/quiz-content-pr && npx wrangler secret put GITHUB_PRIVATE_KEY
```

private keyは`-----BEGIN RSA PRIVATE KEY-----`または`-----BEGIN PRIVATE KEY-----`から終端までを登録する。WorkersはPKCS#1／PKCS#8の両方を受け付ける。

### 4.3 型検査とデプロイ

```bash
cd workers/quiz-content-pr && npm run typecheck && npm run deploy
```

デプロイ後、Cloudflare Access保護下のカスタムURLであることを確認する。

### 4.4 Rate Limiting

例は利用者・API・HTTPメソッドごとに1分10回。`namespace_id`はCloudflareアカウント内で一意な整数へ置換する。bindingがない場合、Workersは安全側に停止して503を返す。

## 5. アプリ／GitHub Pages

GitHubリポジトリの **Settings > Secrets and variables > Actions > Variables** に追加する。

```text
Name: QUIZ_CONTENT_API_URL
Value: https://quiz-content-api.example.com/
```

これは公開エンドポイントであり秘密ではない。private key、App token、installation tokenを`VITE_*`へ設定してはいけない。

`.github/workflows/deploy.yml`はこのRepository variableを`VITE_QUIZ_CONTENT_API_URL`としてビルドへ渡す。設定後にPagesを再デプロイする。

## 6. 利用手順

1. 問題管理で追加・編集・アーカイブし、端末へ保存する。
2. **問題マスター・GitHub連携**を開く。
3. **最新マスターと差分を確認**を実行する。
4. 同期候補と競合を確認する。競合は端末側を保持し、自動上書きしない。
5. 追加・更新・アーカイブの前後差分を開いて確認する。
6. PRタイトル、説明、コミットメッセージを入力する。
7. **送信内容を確定してPull Requestを作成**を押し、確認ダイアログで確定する。
8. 返されたGitHub URLを開き、CI、差分、レビュー結果を確認する。
9. GitHub上で手動マージする。
10. Pagesデプロイ完了後、アプリで最新版を確認し、安全な更新だけを端末へ適用する。

「PR作成成功」は「マージ済み」ではない。画面の**GitHub上の状態を再確認**でopen／closed／mergedを区別する。

## 7. 動作確認

### 7.1 本番接続前

```bash
npm run verify:structure && npm test && npm run build
```

```bash
cd workers/quiz-content-pr && npm run typecheck
```

モック試験は実GitHubへ書き込まない。

### 7.2 本番接続

- 未認証ブラウザー: Accessサインインへ誘導または401
- 許可外メール: 403
- GitHub App未設定／権限不足: 安全な503/502。秘密情報は応答に出ない
- テスト問題1件: `quiz-content/...`ブランチとPRができ、main SHAが変わらない
- 同じ送信の再実行: 同じPRを返し、コミットを増やさない
- mainを別更新後に古い画面から送信: 409競合
- PRマージ後: manifestとdatasetのversionが進み、Pagesから取得できる
- オフライン: 既存問題で学習でき、送信失敗でも端末編集が残る

## 8. 障害対応

|症状|確認|
|---|---|
|401|Accessアプリ、Cookie、AUD、team domain、JWT時刻|
|403|`ALLOWED_ORIGIN`、`ALLOWED_EMAILS`、Access policy|
|409|最新版取得、問題単位の競合、base content version|
|413|変更を複数PRへ分割（上限2MiB）|
|429|1分待って同じ内容を再送|
|502 GitHub permission|Appのインストール先、Contents/Pull requests権限|
|503 configuration|Secrets、Rate Limiting binding、固定変数|
|PRなし・専用ブランチあり|同じ内容を再送。既存ブランチからPRだけを回収する|

## 9. 費用と不要サービス

- D1、R2、KV、Durable Objectsは本実装で使用しない。
- Cloudflare WorkersはFree planを利用できるが、公式の現行上限・CPU時間・Rate Limitingの提供条件を運用開始時に確認する。2026-10時点の公式LimitsではFree planのRequestsは100,000/day、CPU timeは10msと記載されている。
- 小規模な個人利用はリクエスト数の無料枠に収まりやすいが、RSA署名、JSON検証、GitHub API連携のCPU使用量、Accessの契約条件、カスタムドメイン費用によって有料化が必要になる可能性がある。
- GitHub App API自体に本実装固有の追加サービス料金はないが、GitHub Pages、Actions、private repositoryの利用条件は契約プランに従う。

参照:

- GitHub REST Git references: https://docs.github.com/en/rest/git/refs
- GitHub REST Git trees: https://docs.github.com/en/rest/git/trees
- GitHub REST Git commits: https://docs.github.com/en/rest/git/commits
- GitHub App installation token: https://docs.github.com/en/rest/apps/apps#create-an-installation-access-token-for-an-app
- GitHub Pull Requests: https://docs.github.com/en/rest/pulls/pulls#create-a-pull-request
- Cloudflare Access JWT validation: https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
- Workers Rate Limiting binding: https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
- Workers limits: https://developers.cloudflare.com/workers/platform/limits/
- Workers pricing: https://developers.cloudflare.com/workers/platform/pricing/
