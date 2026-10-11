# Study Quiz 5.0.0 要件定義

## 1. 目的

LPIC-1 Exam 101の学習を、通信断時にも継続できるローカルファーストPWAとして提供する。共有問題・解説はCloudflare D1を正本とし、学習履歴・設定・メモ・ローカル専用問題は端末内に保持する。

## 2. データ正本と所有権

|データ|正本|外部送信|
|---|---|---|
|共有問題・解説|Cloudflare D1|Access認証後、明示確認した差分だけ|
|ローカル専用問題|端末localStorage|禁止|
|学習履歴・FSRS・設定・メモ・お気に入り|端末localStorage|禁止|
|問題snapshot|`public/content` / IndexedDB|D1から生成・cacheする派生データ|

GitHub `public/content`は編集正本ではなく、D1 seed生成元兼offline snapshotとする。GitHub Pull Requestによる問題更新経路は5.0.0で廃止する。

## 3. 機能要件

### FR-01 初回設定

試験日、出題上限、新規上限、非学習日、既定フィルター、テーマを設定できること。

### FR-02 問題管理

- 問題の登録、編集、検索、絞込、アーカイブ、復元ができること。
- `single`、`multiple`、`text`を扱うこと。
- 問題IDを一意に保つこと。
- 新規手動問題、CSV取込、AI類似問題は`local-only`を既定とすること。
- 利用者が明示的に`shared`へ変更した問題だけをD1反映候補とすること。

### FR-03 学習・履歴

- 条件選択、適応型セッション、中断・再開、3方式採点、FSRS復習を提供すること。
- 回答時点snapshotを履歴へ保持し、後日の問題変更から過去表示を独立させること。
- 履歴、FSRS、個人メモをD1へ送信しないこと。

### FR-04 バックアップ

- 完全バックアップversion 10を出力し、version 2～10を読めること。
- 復元前検証、差分表示、事前退避、チェックサムを維持すること。
- APIキーと内部トランザクション状態を含めないこと。

### FR-05 D1読取り・同期

- `GET /api/content/snapshot`からD1問題マスターを取得すること。
- D1取得失敗時は同梱snapshot、IndexedDB検証済みcache、端末seedへ順にfallbackすること。
- D1・直前同期fingerprint・端末問題の三者比較を行うこと。
- 端末で変更した問題を自動上書きしないこと。
- D1から消えた共有問題は物理削除せず端末でアーカイブすること。
- `local-only`へ切り替えた問題はD1更新・削除の自動同期から独立させること。

### FR-06 D1書込み

- D1送信前に追加・更新・アーカイブ、変更前後、件数、ローカル専用除外件数を表示すること。
- `ConfirmDialog`で明示確認した場合だけ送信すること。
- 書込みは`POST /api/content/changes`へ送ること。
- Cloudflare Access認証popup内からsame-origin relayで送信すること。
- `local-only`、学習履歴、メモ、APIキーをpayloadへ含めないこと。

### FR-07 Worker検証

- Access JWTのRS256署名、issuer、AUD、iat、nbf、expを検証すること。
- `ALLOWED_EMAILS`の許可リストを検証すること。
- 許可Originまたは認証済みsame-origin relayだけを受け付けること。
- command schema、サイズ、idempotency key再計算、content version、dataset version、question fingerprintを検証すること。
- `distribution`を含むQuestionを拒否すること。
- 更新ごとにbefore/after、主体、メール、理由、冪等キーを監査ログへ記録すること。
- 冪等応答を保存し、再送で重複更新しないこと。
- TTL付きwrite lockとD1 batchを使い、同時更新を競合停止すること。

### FR-08 公開API

|Method|Path|認証|用途|
|---|---|---|---|
|GET|`/api/content/health`|公開|D1初期化状態と件数|
|GET|`/api/content/snapshot`|公開|共有問題snapshot|
|GET|`/api/content/access-session`|Cloudflare Access|popup relay画面|
|POST|`/api/content/changes`|Cloudflare Access|共有問題差分反映|

## 4. 非機能要件

- Node.js 20.19以上。検証基準はNode.js 24系。
- TypeScript `strict=true`をアプリ、テスト、D1 Workerで維持する。
- `npm run check`は構成、seed、単体、アプリ型、Worker型、build、E2Eを実行する。
- 構成検証は旧GitHub PR Worker・旧API・旧テストの再混入を失敗させる。
- Service Worker v25でapp shellとoffline snapshotを利用可能にする。
- 認証・認可、CSP、Origin制限、秘密情報非同梱を弱めない。

## 5. D1スキーマ

現行migrationは次の2件だけとする。

1. `0001_schema.sql`: schema、制約、index、監査、冪等性、write lock。
2. `0002_seed_content.sql`: 既存100問とcontent version。

今回の整合修正ではデータモデル変更がないため、新規migrationを追加しない。
