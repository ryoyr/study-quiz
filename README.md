# Study Quiz

LPIC-1 Exam 101向けのローカルファースト学習PWAです。Cloudflare D1を共有問題・解説の正本としつつ、学習用データとローカル専用問題は端末に保持し、完全オフラインでも利用できます。

## 主な機能

- 試験枠・学習範囲・理解度・出題方法・個別問題による出題条件
- 学習範囲、理解度、出題方法の複数選択
- 複数の出題方法（おすすめ、未回答、復習期限、苦手）の重複排除付き統合
- 適応型セッション、回答速度、理解度、FSRS復習日の記録
- CSV一括登録、問題編集、アーカイブ、類似問題生成
- CSVから択一・複数選択・入力回答を混在登録
- 類似問題生成・AI質問・一括ファクトチェックの3回答方式対応
- 学習履歴、統計、ストリーク、間違いノート、お気に入り・メモ
- JSON完全バックアップ、復元前差分プレビュー、自動安全バックアップ、旧形式からの移行
- バックアップ破損検知、端末内データ自己診断、更新後の読戻し検証
- 複数タブの同時編集検知と、古い画面状態からの上書き防止
- ブラウザー永続保存の状態・容量逼迫の確認と、利用者操作による保持強化
- PWAインストール、オフライン起動、更新通知
- キャッシュ容量不足やNavigation Preload失敗時も通信済み応答へフォールバック
- PWAショートカット（学習、記録、バックアップ）とブラウザー標準インストール導線
- 5種類の配色テーマと、独立した端末連動・ライト・ダーク設定
- 統一SVGアイコン、クイックアクセス、現在地を明示する固定ナビゲーション
- 削除・アーカイブ時のキーボード対応確認ダイアログとフォーカス復帰
- 問題編集の入力長・タグ件数制約と保存失敗通知
- AI JSONの安全な抽出・限定修復・スキーマ検証・最大3回再生成と、レビュー後だけの問題登録・適用
- 問題品質対象の複合選択・件数確認・個別調整・8問推奨分割と、正答・誤答・解説・根拠・重複を確認する品質重視プロンプト
- 品質提案の全回答定義比較、適用・却下・再生成、初期データ更新JSON
- 問題編集の保存前プレビュー、問題改訂履歴、解説の改行・段落・箇条書き安全表示
- Cloudflare D1を共有問題・解説の正本とし、IndexedDB v3を検証済みオフラインcacheとして利用
- D1 snapshot・同梱snapshot・IndexedDB・端末seedの多段fallback
- `local-only`問題をD1 payloadから除外する端末／Worker二重境界
- Cloudflare Access JWTを検証する同一オリジンpopup relay、D1監査・冪等性・短期排他

## 動作環境

- Node.js 20.19以降
- npm
- ChromeまたはChromium（E2Eアクセシビリティ試験用）

## セットアップ

```bash
npm ci --no-audit --no-fund
npm run dev
```

既定の公開パスは `/study-quiz/` です。ルート配信する場合は次のように指定します。

```bash
VITE_BASE_PATH=/ npm run build
```

D1連携を有効にする場合は、公開Worker URLだけを設定します。Access設定や秘密値を`VITE_*`へ設定してはいけません。

```bash
VITE_QUIZ_CONTENT_API_URL=https://<your-worker>.workers.dev/ npm run build
```

GitHub PagesからのD1書込みではCloudflare Access保護下の認証popupを開き、popupからWorker APIへ同一オリジンで送信します。読取りAPIは公開できますが、書込みAPIはAccess JWT、許可メール、Origin/relay、fingerprint、冪等キーをWorkerで再検証します。

## Cloudflare D1セットアップ

指定済みbindingは次のとおりです。

```text
binding = DB
database_name = study-quiz-db
database_id = e342a769-d2fc-493f-88a7-9aac70f7914c
```

本番適用前にD1をexportし、Access設定を`workers/quiz-content-db/wrangler.toml`へ反映してください。

```bash
npm run d1:seed:build
npm run d1:migrate:local
npm run worker:dev
npm run check
npx wrangler d1 export study-quiz-db --remote --output study-quiz-db-before-v5.sql --config workers/quiz-content-db/wrangler.toml
npm run d1:migrate:remote
npm run worker:deploy
```

設計、データ所有権、rollbackは`D1_MIGRATION_PLAN.md`、進捗は`TASKS_D1.md`を参照してください。

## 品質確認

```bash
npm run check
```

`check` は構成検証、単体試験、TypeScriptビルド、Chrome E2Eアクセシビリティ試験を順番に実行します。

個別実行:

```bash
npm run verify:structure
npm run test
npm run typecheck
npm run build
npm run test:e2e
```

## CSV取込

共通の必須列は `id, category, text` です。`questionType` を省略した行は従来互換の `single` として扱います。

|回答方式|`questionType`|必要な回答列|
|---|---|---|
|択一|`single`|`choice1`, `choice2`（最大`choice8`）と、1開始の`answer`|
|複数選択|`multiple`|選択肢と、1開始の番号を`|`で区切った`answers`（例: `1|3`）|
|入力|`text`|許容回答を`|`で区切った`acceptedAnswers`（例: `LVM|lvm`）|

画面の「CSVテンプレートを出力」から3方式を含むテンプレートを取得できます。旧形式のCSVはそのまま取り込めます。

## 出題条件の仕様

- 各複数選択欄は横スクロール式のチェックチップです。
- 学習範囲と理解度は、それぞれ選択項目内のOR条件として評価します。
- 学習範囲と理解度の間はAND条件です。
- 出題方法を複数選ぶと候補を和集合にし、同じ問題は1問へ統合します。
- 「すべて」は同じ選択グループ内で排他的です。
- 個別問題を指定した場合は、出題方法より個別指定を優先します。

## データ保存

学習で実際に使う問題、ローカル専用問題、履歴、設定はブラウザーの`localStorage`へ保持します。D1には共有問題・解説だけを保存し、学習履歴・メモ・APIキーは送信しません。初回設定と検証済みD1 snapshotの互換保存はIndexedDBを使用します。完全バックアップversion 10には偶発的な破損・編集を検知するチェックサムを付与します（電子署名ではありません）。

共有問題マスターの正本はD1です。`public/content`はmigration生成元兼offline snapshotへ降格しました。最新版適用では前回配布fingerprintと端末データを比較し、端末編集を自動上書きしません。D1から削除された問題も、履歴・FSRSの問題ID参照を維持するため端末ではアーカイブします。

問題・解説の品質向上では、問題JSONの出力、修正・補足提案JSONの取込、適用前後レビュー、実行環境への適用ができます。適用済み内容は初期データ更新JSONとして出力し、次で新規環境の初期問題へ反映します。

```bash
node tools/apply_question_seed_updates.mjs <seed-update-pack.json>
```

### 安全な復元

復元ファイルを選択すると、現在データとの差分を「追加・置換・削除・変更なし」で表示します。配列形式の領域では前後の件数も確認できます。復元は確認チェック後だけ実行でき、実行直前に現在データを `study-quiz-pre-restore-*.json` として自動保存します。安全バックアップを作成できない場合、復元は開始しません。

## ディレクトリ

- `src/components`: 共通UI
- `src/pages`: 機能画面
- `src/services`: 出題、保存、分析、外部連携
- `src/infrastructure`: IndexedDBとリポジトリ
- `src/types`: ドメイン型
- `tests`: Node単体試験
- `scripts`: 構成検証とE2E試験
- `docs`: 要件、基本設計、詳細設計、トレーサビリティ
- `tools`: 配布資材の再生成補助
- `workers/quiz-content-db`: D1 schema、Access認証、read/write API、監査

D1の正本評価は`docs/question-master-authority-assessment.md`、Cloudflare設定は`docs/d1-cloudflare-setup.md`、要件・設計・追跡関係は`docs/requirements.md`、`docs/basic-design.md`、`docs/detailed-design.md`、`docs/traceability.md`を参照してください。旧GitHub PR Workerは5.0.0の実行・ビルド・デプロイ対象ではありません。

## バージョン

- アプリ: 5.0.0
- ストレージスキーマ: 9
- 完全バックアップ形式: 10

## 表示テーマ

- 配色テーマ: オーロラ / フォーカス / フォレスト / サンセット / モノクロ
- 明るさ: 端末に合わせる / ライト / ダーク
- 配色テーマと明るさは独立して保存されます。旧設定には「オーロラ」を自動補完します。
