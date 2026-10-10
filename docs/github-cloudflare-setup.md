# GitHub App／Cloudflare Workers 設定・運用手順

## 1. アーキテクチャ

```text
Study Quiz PWA
https://ryoyr.github.io/study-quiz/
  ├─ 問題編集・端末内保存（既存localStorage）
  ├─ public/content の最新版取得
  └─ PR作成の明示確認
       ↓ top-level popup（CORS fetchではない）
Cloudflare Access + Google等の外部IdP
https://study-quiz-content-pr.forxdevelop.workers.dev/api/quiz-content/access-session
       ↓ 認証後、同一オリジンpopup内からPOST
Cloudflare Worker
/api/quiz-content/pull-requests
  ├─ Access JWT署名/issuer/AUD/iat/nbf/exp/許可メールを再検証
  ├─ Origin、同一オリジンrelay、Rate Limit、入力を検証
  ├─ ryoyr/study-quiz、main、public/contentを固定
  └─ GitHub App study-quiz-content-managerのinstallation token（短命）
       ↓ GitHub REST API
GitHub ryoyr/study-quiz
  ├─ blobs → tree → commit → refs/heads/quiz-content/...
  └─ Pull Request → 人が確認してmainへマージ
```

Access認証用popupはWorkerをtop-level siteとして開く。このため`CF_Authorization`はfirst-party contextで使用され、GitHub PagesからWorkerへのクロスサイトXHR Cookieに依存しない。Access JWTやGitHub App秘密情報をPWAへ返さず、popupとPWAの通信は固定Originへの`postMessage`だけに限定する。アプリやWorkersからmainを更新するAPI、自動マージAPIは呼び出さない。

## 2. GitHub App

### 2.1 作成

1. GitHubの **Settings > Developer settings > GitHub Apps > New GitHub App** を開く。
2. GitHub App nameを`study-quiz-content-manager`、Homepage URLを`https://ryoyr.github.io/study-quiz/`に設定する。
3. Webhookを使わない場合は **Active** を解除する。
4. Repository permissionsを次だけ設定する。
   - **Contents: Read and write** — 問題JSON、manifest、ブランチ、コミット
   - **Pull requests: Read and write** — PR作成・状態確認
   - **Metadata: Read-only** — 既定の必須権限
5. `Where can this GitHub App be installed?` は運用主体に限定する。
6. 作成後にprivate keyを1つ生成し、安全な端末へ一時保存する。
7. **Install App** から `Only select repositories` を選び、`ryoyr/study-quiz`だけへインストールする。
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

### 3.1 現行値

|項目|設定値|
|---|---|
|Worker|`https://study-quiz-content-pr.forxdevelop.workers.dev`|
|Access team domain|`abrsb.cloudflareaccess.com`|
|認証対象|`study-quiz-content-pr.forxdevelop.workers.dev/api/quiz-content/*`|
|認証方式|Google等の既存外部IdP|
|API|`/api/quiz-content/pull-requests`|
|認証セッション画面|`/api/quiz-content/access-session`|
|許可Origin|`https://ryoyr.github.io`|

### 3.2 Access Application

1. Zero Trust > Access controls > Applicationsで、既存Self-hosted applicationを開く。
2. Application domain/pathを`study-quiz-content-pr.forxdevelop.workers.dev/api/quiz-content/*`へ変更する。同じ既存Applicationを編集し、AUDを変えない。
3. Allow policyはGoogle等の既存IdPで認証した許可利用者だけを対象にする。**Bypass Everyoneを追加しない**。
4. **Advanced settings > Cross-Origin Resource Sharing (CORS) settings > Bypass OPTIONS requests to origin** は既存どおり有効にする。WorkerのOPTIONS検証も維持する。
5. Application Audience (AUD) TagをCloudflare DashboardのWorker変数`ACCESS_AUD`へ設定する。
6. `ALLOWED_EMAILS`へ書込み可能なメールだけをカンマ区切りで設定する。Accessへログインできても、この一覧にない利用者はWorkerが403で拒否する。
7. Worker変数`ACCESS_TEAM_DOMAIN`は`abrsb.cloudflareaccess.com`、`ALLOWED_ORIGIN`は`https://ryoyr.github.io`とする。後者に`/study-quiz/`や末尾スラッシュを付けない。

### 3.3 302/CORSの根本原因

Cloudflare公式CORS仕様では、Access保護先へ到達するCORS要求には有効な`CF_Authorization` Cookieが必要である。未ログインのXHR/fetchはAccessログインへ302となるが、ブラウザーはXHR内で外部IdP画面を処理できず、ログイン応答にもAPI用CORSヘッダーがないためCORSエラーになる。さらにOPTIONSには設計上Cookieが付かない。今回はOPTIONSバイパスとWorkerのOPTIONS応答は既に正しく、実POSTの認証Cookie欠落が原因である。

`credentials: "include"`は既存Cookieを送る指定であり、XHR内でAccessログインを完了させたり、第三者Cookie制限を解除したりしない。Cloudflare公式も、クロスオリジンAccessでは対象ドメインへ先にログインする必要があり、プライベートモード等で`CF_Authorization`が第三者Cookieとしてブロックされると失敗すると説明している。

### 3.4 採用方式

PWAの明示確認ボタンからAccess保護された`/api/quiz-content/access-session`をpopupのtop-level navigationで開く。302は通常の画面遷移としてGoogle等のIdPへ進み、認証後にWorkerが署名・issuer・AUD・期限・許可メールを検証してrelayページを返す。relayページは同じWorkerオリジンからAPIへPOSTするため、Access Cookieはfirst-party contextで送られる。

- Accessは無効化しない。
- OPTIONS以外をAccessで無条件Bypassしない。
- Access JWTをPWAへ渡さない。
- Service TokenやGitHub App秘密情報をPWAへ渡さない。
- popupは固定`https://ryoyr.github.io`との`postMessage`だけを許可する。
- Workerは同一オリジンrelayについて`Sec-Fetch-Site: same-origin`と専用ヘッダーを検証する。
- 既存の直接CORS APIと`credentials: "include"`は互換用に維持するが、画面操作はrelay方式を使う。

### 3.5 比較した方式

|方式|クロスサイトCookie依存|安全性・互換性|判定|
|---|---:|---|---|
|`credentials: include`だけ|あり|未ログイン302と第三者Cookie制限を解消しない|不採用|
|対象Workerへ事前ログインしてXHR再試行|あり|Cloudflare公式の手動方式だが、プライベートモード等では失敗|補助策|
|ブラウザーへAccess Service Tokenを埋込|なし|Client Secret漏えいとなり、利用者単位メール認可も失う|禁止|
|APIパスをAccess Bypassし、独自Bearerだけで保護|なし|Access enforcement/logを失い、現行要件に反する|不採用|
|PagesとAPIを同一siteのカスタムドメインへ移行|なし|長期的に単純だがDNS・配信URL・Access Application変更が大きい|将来候補|
|Access認証popup内の同一オリジンrelay|なし（API実行時）|Access、外部IdP、HttpOnly Cookie、JWT再検証を維持し変更範囲が小さい|**採用**|

重要:

- Worker URL全体または`/api/quiz-content/*`をAccessで保護する。
- Workers自身も`Cf-Access-Jwt-Assertion`を外部公開JWKで検証する。
- CORSは認証の代わりではない。

## 4. Workersデプロイ

### 4.1 準備

`workers/quiz-content-pr/wrangler.toml`には公開可能な固定値だけを記録済み。`ACCESS_AUD`と`ALLOWED_EMAILS`はCloudflare DashboardのVariablesで設定し、`keep_vars = true`でデプロイ時に維持する。`namespace_id`は現在デプロイ済みRate Limiting bindingの値と一致することをDashboardで確認する。

```bash
cd workers/quiz-content-pr && npm install
```

初回`npm install`で作成されたWorker用`package-lock.json`はレビューしてコミットし、以後は`npm ci`を使用する。現時点の成果物にはWorker用lockがないため、通常CIへ組み込む前に生成が必要。

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

デプロイ後、`https://study-quiz-content-pr.forxdevelop.workers.dev/api/quiz-content/*`がCloudflare Access保護下であることを確認する。

### 4.4 Rate Limiting

利用者・API・HTTPメソッドごとに1分10回。`namespace_id`はCloudflareアカウント内で一意な既存デプロイ値と一致させる。bindingがない場合、Workersは安全側に停止して503を返す。

## 5. アプリ／GitHub Pages

`.github/workflows/deploy.yml`は公開エンドポイントだけを次の値でビルドへ渡す。

```text
VITE_QUIZ_CONTENT_API_URL=https://study-quiz-content-pr.forxdevelop.workers.dev/
```

これは公開URLであり秘密ではない。GitHub App `study-quiz-content-manager`のprivate key、App ID、installation ID、installation token、Cloudflare Access Service Token、Access JWTを`VITE_*`へ設定してはいけない。Pages再デプロイ後、成果物へ公開Worker URLだけが入り、秘密情報がないことを検査する。

## 6. 利用手順

1. 問題管理で追加・編集・アーカイブし、端末へ保存する。
2. **問題マスター・GitHub連携**を開く。
3. **最新マスターと差分を確認**を実行する。
4. 同期候補と競合を確認する。競合は端末側を保持し、自動上書きしない。
5. 追加・更新・アーカイブの前後差分を開いて確認する。
6. PRタイトル、説明、コミットメッセージを入力する。
7. **送信内容を確定してPull Requestを作成**を押し、確認ダイアログで確定する。
8. Cloudflare Access認証popupが開く。未認証ならGoogle等の既存IdPでログインする。popupは同一オリジンPOSTの完了後に閉じる。
9. 返されたGitHub URLを開き、CI、差分、レビュー結果を確認する。
10. GitHub上で手動マージする。
11. Pagesデプロイ完了後、アプリで最新版を確認し、安全な更新だけを端末へ適用する。

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

### 7.2 Cloudflare設定後の確認

実PRを作成しない段階では、次までを確認する。

```bash
curl -i -X OPTIONS "https://study-quiz-content-pr.forxdevelop.workers.dev/api/quiz-content/pull-requests" -H "Origin: https://ryoyr.github.io" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: content-type,x-idempotency-key"
```

期待値: 204、`Access-Control-Allow-Origin: https://ryoyr.github.io`、GET/POST/OPTIONS、`content-type,x-idempotency-key`。

ブラウザーでは`https://ryoyr.github.io/study-quiz/`から認証popupを開き、Google等でログイン後、popup内の同一オリジンPOSTが302にならないことをNetworkで確認する。未認証でAPIを直接呼ぶとAccessログイン302になるのは正常である。

- 未認証セッション: Accessサインインへ誘導。Workerへ未認証で到達した場合は401。
- 不許可Origin: 403。
- Access許可済みでも`ALLOWED_EMAILS`外: 403。
- GitHub App未設定／権限不足: 安全な503/502。秘密情報は応答に出ない。
- モックで同じ送信を再実行: 同じPRを返し、コミットを増やさない。
- モックでmain競合: 409。
- オフライン／認証失敗: 既存問題で学習でき、端末編集が残る。

実PR試験は別途明示承認後に限定問題1件で行う。本作業では実行しない。実施時も`quiz-content/...`ブランチとPRだけが作られ、main SHAが変わらないことを確認し、手動レビュー前にマージしない。

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
- Cloudflare Access CORS: https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/cors/
- Cloudflare Access authorization cookie: https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/
- Cloudflare Access JWT validation: https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
- Cloudflare Access application paths: https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/
- Cloudflare Access policies and Bypass behavior: https://developers.cloudflare.com/cloudflare-one/access-controls/policies/
- Workers Rate Limiting binding: https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
- Workers limits: https://developers.cloudflare.com/workers/platform/limits/
- Workers pricing: https://developers.cloudflare.com/workers/platform/pricing/
