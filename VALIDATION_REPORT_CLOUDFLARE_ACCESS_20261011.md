# 検証報告 — Cloudflare Access 302/CORS修正

検証日: 2026-10-11  
対象アプリ: Study Quiz 4.7.0  
Pages: `https://ryoyr.github.io/study-quiz/`  
Worker: `https://study-quiz-content-pr.forxdevelop.workers.dev`  
API: `/api/quiz-content/pull-requests`  
GitHub App: `study-quiz-content-manager`  
対象リポジトリ: `ryoyr/study-quiz`

## 1. 結論

発生していたPOSTの302はWorkerコードのCORS応答ではなく、Workerへ到達する前のCloudflare Accessログイン応答である。`credentials: "include"`、WorkerのOPTIONS、AccessのOPTIONSバイパスが正しくても、未ログインのcross-origin fetchはログインを完了できず、`CF_Authorization`が第三者Cookieとして送信されない環境では実POSTがAccessログインへ302となる。

修正ではAccessを無効化せず、`/api/quiz-content/access-session`をtop-level popupで開く。Google等の既存IdPでAccess認証後、popupから同一WorkerオリジンでAPIへPOSTする。Cookieはpopupのfirst-party contextで使用されるため、GitHub PagesからWorkerへのクロスサイトCookieに依存しない。Access JWT、Service Token、GitHub App秘密情報はPWAへ渡さない。

## 2. Cloudflare公式仕様との照合

- Access保護先へのCORS要求には有効な`CF_Authorization` Cookieが必要。
- 未ログインのsimple CORS要求はCORSエラーとなり、公式の基本対応は対象ドメインへ先にログインして元ページを更新すること。
- preflight OPTIONSは設計上Cookieを含まないため、Access側でOPTIONSをoriginへバイパスするかAccessが応答する必要がある。
- private/incognito環境では`CF_Authorization`が第三者Cookieとしてブロックされ、cross-origin要求が失敗し得る。
- Cloudflareがoriginへ送る`Cf-Access-Jwt-Assertion`は、origin側でも公開JWK、issuer、AUD等を検証することが推奨される。
- Access BypassはAccess enforcementとログを無効化するため、今回のAPI認証には使用しない。
- Access application pathはより具体的な設定が優先されるため、単一の既存Applicationで`/api/quiz-content/*`を保護する。

参照:

- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/cors/
- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/
- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
- https://developers.cloudflare.com/cloudflare-one/access-controls/policies/
- https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/

## 3. 方式比較

|方式|クロスサイトCookie依存|Access維持|秘密情報|変更規模|判定|
|---|---:|---:|---|---:|---|
|`credentials: include`追加だけ|あり|維持|なし|最小|既に実施済みで解決しない|
|対象Workerへ手動ログイン後にXHR再試行|あり|維持|なし|小|第三者Cookie制限で不安定|
|Service Tokenをフロントへ埋込|なし|Service Auth|Client Secret漏えい|小|禁止|
|APIパスをAccess Bypassし独自Bearer化|なし|失う|設計次第|中|要件違反|
|Pages/APIを同一siteのカスタムドメインへ移行|なし|維持|なし|大|長期候補|
|Access popup内で同一オリジンrelay|なし（API実行時）|維持|追加秘密なし|中小|採用|

## 4. 実装

### 4.1 フロントエンド

- `src/services/contentPullRequestApi.ts`
  - 直接APIの`credentials: "include"`を互換用に維持。
  - Accessセッションpopupを利用するtransportを追加。
  - popupのoriginとwindow source、request ID、応答statusを検証。
  - Access JWT、Cookie、Service Tokenを保存しない。
- `src/pages/QuestionMasterPage.tsx`
  - PR作成と状態確認をAccessセッションtransportへ切替。
  - 確認ダイアログの明示操作中にpopupを開き、popup blockerに対応。

### 4.2 Worker

- `workers/quiz-content-pr/src/index.ts`
  - 認証済み`GET /api/quiz-content/access-session`を追加。
  - API、OPTIONS、セッションを明示的にルーティング。
  - セッションにも利用者単位Rate Limitを適用。
- `workers/quiz-content-pr/src/http.ts`
  - strict CSP、no-store、no-referrerのrelay HTMLを追加。
  - `postMessage`相手を`https://ryoyr.github.io`へ固定。
  - relay要求は`Sec-Fetch-Site: same-origin`と専用ヘッダーを要求。
  - 専用ヘッダーはCORS Allow-Headersへ追加せず、cross-origin生成を防止。
- `workers/quiz-content-pr/src/auth.ts`
  - 既存RS256署名、issuer、AUD、exp、nbf、メール検証を維持。
  - `iat`必須、未来iat拒否、`exp > iat`を追加。
- `workers/quiz-content-pr/src/types.ts`
  - GitHub、Access、Origin、Rate Limitの型境界を確認。秘密値のクライアント共有なし。

### 4.3 設定

- `.github/workflows/deploy.yml`
  - 公開Worker URLを`VITE_QUIZ_CONTENT_API_URL`へ固定。
  - Worker strict TypeScript検査を追加。
  - GitHub App／Access秘密情報は設定しない。
- `workers/quiz-content-pr/wrangler.toml`
  - `ryoyr/study-quiz`、main、`public/content`、`https://ryoyr.github.io`、`abrsb.cloudflareaccess.com`を公開設定として固定。
  - `ACCESS_AUD`、`ALLOWED_EMAILS`はDashboard Variablesで維持。
  - GitHub App ID、installation ID、private keyはSecretsのまま。

## 5. セキュリティ要件確認

|要件|結果|
|---|---:|
|Cloudflare Access／Google等の外部IdP維持|PASS（コード・設定手順）|
|Workerを無認証化しない|PASS。セッション・APIともAccess保護が前提|
|OPTIONS以外の無条件Bypassなし|PASS|
|JWT署名・issuer・AUD・iat・nbf・exp検証|PASS|
|許可メールだけが書込み可能|PASS|
|不許可Origin拒否|PASS|
|popup relayのsource/origin固定|PASS|
|GitHub App秘密情報をフロントへ含めない|PASS|
|Access JWTをフロントへ返さない|PASS|
|固定リポジトリ・main・`public/content`|PASS|
|main直接更新・自動マージなし|PASS|
|同一内容のPR重複防止|PASS|

## 6. テスト結果

|検証|結果|備考|
|---|---:|---|
|Worker strict TypeScript|PASS|`tsc -p workers/quiz-content-pr/tsconfig.json`|
|content API隔離strict TypeScript|PASS|ES2023/DOM/Bundler|
|Cloudflare/GitHub関連回帰|PASS 21/21|実GitHub APIはFakeのみ|
|構成検証|PASS|URL、Wrangler、秘密非混入を含む|
|OPTIONS許可Origin|PASS|204、CORS headers、認証／GitHub未呼出し|
|不許可OPTIONS Origin|PASS|403|
|未認証セッション|PASS|401|
|未認証API|PASS|401|
|不許可Origin|PASS|403|
|JWT署名改ざん・AUD・期限・未来iat|PASS|すべて拒否|
|未許可メール|PASS|403相当|
|同一オリジンrelay|PASS|same-originのみ受入れ|
|cross-site偽relay|PASS|403|
|PR冪等性|PASS|2回目は同じPR、commit 1回|
|main直接更新／自動マージ静的検査|PASS|該当APIなし|
|一時フロントbundle秘密情報検査|PASS|623,425 bytes、秘密パターン0|
|補助全テスト|145/151成功|失敗6スイートは`ts-fsrs`未取得による起動失敗|

### 6.1 公式npmコマンド

|コマンド|exit|結果|
|---|---:|---|
|`npm ci --no-audit --no-fund`|1|Vite 7.3.6 tarball取得がHTTP 403|
|`npm run typecheck`|1|ロック依存未取得。React型、`ts-fsrs`、Vite型を解決不能|
|`npm test`|127|ローカル`tsx`未取得|
|`npm run build`|1|型検査で停止しVite build未到達|
|`npm run check`|127|構成検証成功後、`npm test`で停止|

上記を成功扱いにしない。通常CIでlockfileどおり依存取得後、`npm run check`完走が必要。

## 7. 既存データ・実GitHubの保全

- `public/content/manifest.json`: 作業前後SHA-256一致。
- `public/content/questions/lpic-101.json`: 作業前後SHA-256一致。
- `src/data/questions.ts`: 作業前後SHA-256一致。
- GitHub APIはモックだけを使用し、実ブランチ、コミット、PRを作成していない。
- main更新API、自動マージAPIは追加していない。

## 8. リポジトリ・本番環境の確認境界

公開GitHubページ`ryoyr/study-quiz`は確認できたが、公開main上では今回の完全版にある`workers/quiz-content-pr`等の必須パスを取得できず、個別URLは404だった。Git clone/raw/APIは実行環境ポリシーでHTTP 403となったため、今回の修正元は2026-10-11 03:05:15生成の最新`project_dump_full.txt`と、前回検証済み完全版ZIPを使用した。

本番Worker、GitHub Pages、Cloudflare DashboardへのHTTP確認も実行環境URLポリシーで遮断された。Cloudflare資格情報を使用したデプロイ、Access設定変更、実IdPログイン、実PR作成は行っていない。

## 9. Cloudflare側で必要な設定

1. 既存Access Self-hosted applicationを編集し、対象を`study-quiz-content-pr.forxdevelop.workers.dev/api/quiz-content/*`にする。
2. 既存Google等のIdPとAllow policyを維持する。Bypass Everyoneを作成しない。
3. 既存の**Bypass OPTIONS requests to origin**を維持する。
4. 既存Applicationを編集してAUDを維持し、その値をWorker variable `ACCESS_AUD`に設定する。
5. `ALLOWED_EMAILS`へ実際に書込みを許可するメールだけを設定する。
6. `ALLOWED_ORIGIN=https://ryoyr.github.io`とする。`/study-quiz/`を含めない。
7. `ACCESS_TEAM_DOMAIN=abrsb.cloudflareaccess.com`とする。
8. `RATE_LIMITER`の`namespace_id`が既存デプロイ値と一致することを確認する。
9. GitHub App `study-quiz-content-manager`のApp ID、installation ID、private keyをWorker Secretsで維持する。
10. 修正版Workerをデプロイ後、Pagesを再ビルド・デプロイする。

## 10. 本番での未確認事項

- 実Access Applicationの対象path、AUD、policy順序、IdP、session duration。
- `ALLOWED_EMAILS`の実値。
- Rate Limiting namespace IDの実値。
- 修正版Workerのデプロイ成否。
- Accessログイン往復中にpopup openerが対象ブラウザーで維持されること。
- Chrome、Edge、Safari、プライベートモードでのpopup relay。
- 実Pages成果物の秘密情報スキャン。
- 実PR作成、同一内容再送、main SHA不変。今回はユーザー指示により未実施。

## 11. 本番受入手順

1. Cloudflare設定とWorkerデプロイを完了する。
2. OPTIONSをcurlで確認する。
3. 未認証の`/api/quiz-content/access-session`がAccessログインへ遷移することを確認する。
4. `https://ryoyr.github.io/study-quiz/`でPR作成確認まで進み、popupからGoogle等で認証する。
5. DevToolsで、API POSTのinitiatorがpopup、originがWorker、statusが302ではないことを確認する。
6. 不許可Origin、未許可メールをそれぞれ403で確認する。
7. 実PR試験は別途明示承認後に限定変更で行い、main SHAが変わらないこと、再送で重複しないことを確認する。

## 12. 成果物整合性

- パッケージ: 213ファイル（`SHA256SUMS_COMPLETE.txt`を含む）。
- 内部SHA-256: 212/212成功。
- ZIP圧縮データ検査: エラー0。
- 展開後SHA-256: 212/212成功。
- 展開後構成検証: 成功。
- 展開後Worker strict TypeScript: 成功。
- 展開後Cloudflare/GitHub関連回帰: 21/21成功。
