# GitHub連携・Pull Request作成機能 回収計画／進捗

基準入力:

- `project_dump_full.txt`（175ファイル、生成 2026-10-11 01:54:20）
- `依頼内容.txt`（問題マスターのGitHub連携・Pull Request作成機能）

## 回収方針

既存の `Question`、問題ID、`study-quiz-questions-v1`、storage schema 9、IndexedDB version 2、完全バックアップ version 10を破壊しない。問題マスター、送信UI、Workers、同期を独立した境界として段階追加し、各回でZIPを作成する。

|回|対象範囲|完了条件|状態|
|---:|---|---|---|
|1|現状調査、互換境界、問題マスターJSON・マニフェスト、検証・安全マージ基盤|既存100問をJSON化し、初回同期でも端末編集を上書きしない単体試験が成功|完了|
|2|変更差分、送信前確認画面、Workers APIクライアント、PR状態表示|追加・更新・アーカイブを可視化し、明示確定時だけ送信する|完了|
|3|Cloudflare Workers、GitHub App認証、Git Data APIによる1コミット、PR作成、認可・CORS・レート制限・冪等化|秘密情報をクライアントへ置かず、モック試験で成功・失敗・再送を検証|完了|
|4|最新マスター同期、競合表示、PWAキャッシュ、回帰試験、設定・運用文書、最終ZIP|既存互換と新機能試験、未実施ゲート、設定待ちを明示|完了|

## 第1回

### 対象範囲

- ダンプ175ファイルの安全な復元と関連処理の追跡
- 問題マスターの外部JSON化
- マニフェスト／データセット検証
- 端末編集を保護するフィンガープリント方式の同期計画

### 計画

1. 問題型、保存、履歴、FSRS、バックアップ、PWA、CIを確認する。
2. 現行 `Question` を変更せず、配布元JSONの契約を追加する。
3. 既存利用者の端末編集と配布元更新を三者比較し、安全な変更だけを適用する。
4. 配布元削除は物理削除せずアーカイブへ変換する。

### 実施内容

- `public/content/manifest.json` と `public/content/questions/lpic-101.json` を追加した。
- `QuestionMaster` 型、厳格なJSON検証、複数データセット間ID重複検出を追加した。
- 前回配布フィンガープリントを基準に、追加・更新・アーカイブ・競合を分類する純粋関数を追加した。
- 初回同期では同梱100問を基準にするため、既存端末で編集済みの問題を配布元データで上書きしない。
- 同期状態の保存キーをStorage Key Registryへ追加した。学習データではなく再取得可能な補助情報のため、完全バックアップ対象外とした。
- 再生成ツール `tools/export_question_master.ts` を追加した。

### 検証結果

- 対象テスト: `tests/questionMasterService.test.ts`
- 実行結果: 5/5成功。
- 確認済み: マニフェスト検証、パストラバーサル拒否、端末編集保護、安全更新、削除のアーカイブ化、データセット間ID重複拒否。
- 公式 `npm ci` は実行環境のパッケージ取得ポリシーによりVite 7.3.6取得がHTTP 403となった。共有済みtsxランナーで追加試験を実行した。

### 残課題

- 送信対象差分の生成と確認UI
- Workers APIクライアント
- GitHub App認証とPR作成Workers
- 最新マスターの画面適用と競合解決導線
- 公式 `npm run check`、Chrome E2E、iOS実機

## 第2回

### 対象範囲

- 端末内問題と配布元問題の差分生成
- 送信前確認画面
- Workers APIクライアント
- Pull Request結果・状態表示

### 計画

1. 問題ID単位で追加・更新・アーカイブを分類する。
2. 変更フィールドの前後値、件数、タイトル、説明、コミットメッセージを送信前に表示する。
3. 利用者の明示確認後だけPOSTし、CookieベースのCloudflare Access認証を利用する。
4. 同じ送信内容から決定的なSHA-256冪等キーを生成する。

### 実施内容

- `questionMasterChangeService` を追加し、完全な変更後Question、変更前フィンガープリント、変更フィールドを生成するようにした。
- `QuestionMasterPage` を問題・教材管理へ追加した。最新版確認、安全同期、差分、PRメタデータ、明示確認、結果URL、open/closed/merged状態を一画面で扱う。
- API対象リポジトリ、ベースブランチ、管理パスはクライアント入力にせずWorkers側で固定する前提とした。
- APIエンドポイントは `VITE_QUIZ_CONTENT_API_URL` のみクライアントへ埋め込み、秘密情報は扱わない。
- 認証Cookieを送る `credentials: include`、安全なエラー形式、HTTPS強制、GitHub URL検証を追加した。

### 検証結果

- 第1回を含む対象テスト: 10/10成功。
- 追加確認: 追加・更新・アーカイブ分類、決定的冪等キー、HTTPS制約、Cookie認証、成功応答検証、安全なエラー整形。
- 実GitHubへの書込みは未実施。WorkersとGitHub Appの本番設定前であり、通常試験では書込みを行わない。

### 残課題

- Workersの認証・認可・GitHub API処理
- APIのモック統合試験
- PWAキャッシュ世代更新、全回帰、設定・運用手順

## 第3回

### 対象範囲

- Cloudflare Access認証・利用者認可
- Workers Rate Limiting binding、CORS、入力サイズ・パス制限
- GitHub App JWTとinstallation access token
- Git Data APIによる複数ファイル1コミットとPull Request作成
- 競合・再送・途中失敗

### 計画

1. JWT署名、issuer、AUD、有効期限、許可メールをWorkers自身でも検証する。
2. リポジトリ、ベースブランチ、管理ルートを環境変数で固定し、クライアント指定を拒否する。
3. ベースSHAからblob、tree、commit、refを作り、1コミットで問題JSONとマニフェストを更新する。
4. 内容由来の専用ブランチ名で再送を回収し、コミット・PRを重複させない。

### 実施内容

- Access JWTを外部署名鍵の`kid`で検証し、RS256、issuer、AUD、exp、nbf、許可メールを確認する実装を追加した。
- CORSは単一の`ALLOWED_ORIGIN`へ限定し、Rate Limiting binding未設定時は書込みを停止する。
- GitHub App秘密鍵から短命JWTを作成し、installation access tokenを取得する。秘密鍵とトークンを応答・ログへ出さない。
- GitHubのベースコミットSHAとtree SHAを固定して読み、問題フィンガープリントとマニフェスト版を再検証する。
- 更新対象をblob化し、base treeからtreeとcommitを作り、専用refを作成してPRを作る。mainへのref更新・自動マージ処理は実装していない。
- 同一冪等ブランチが存在する場合は既存PRを返す。コミット後・PR前の失敗では再送時にPRだけを回収する。
- `wrangler.toml.example`、Workers用package/tsconfigを追加した。

### 検証結果

- 第1～3回の対象テスト: 19/19成功。
- 確認済み: Access JWT、許可メール、CORS、レート超過、任意リポジトリ／パス拒否、問題競合、1コミット、コミット失敗、PR失敗後再送、重複防止。
- GitHub API・Cloudflare Access・Rate Limitingはモック検証。実アカウントへのデプロイと本番接続は未設定・未実施。

### 残課題

- PWAキャッシュの問題マスター向けnetwork-first化
- GitHub／Cloudflare設定手順、障害対応、費用説明
- 公式全回帰、ZIP最終検証

## 第4回

### 対象範囲

- マージ後の最新マスター取得・安全適用・競合表示
- Service Workerキャッシュ
- 回帰・型・構文・bundle検証
- GitHub／Cloudflare設定、利用、障害、費用文書
- 最終成果物と整合性

### 計画

1. 問題マスターをnetwork-firstで取得し、失敗時は直近キャッシュへ戻す。
2. 既存Question、ID、履歴・FSRS、schema 9、backup 10を維持する。
3. 実行できない公式ゲートと本番未設定を成功扱いしない。
4. 各回ZIPと最終ZIPをSHA-256・展開・内部ハッシュで検証する。

### 実施内容

- Service Worker v23へ更新し、`public/content/**`をnetwork-first化した。HTTP非2xx、タイムアウト、オフライン時は直近キャッシュへ戻す。
- PWA PNG 4件と決定的な再生成ツール、初期問題更新ツールを復元した。
- アプリ版を4.7.0へ更新した。storage schema 9、IndexedDB 2、backup 10は据え置いた。
- GitHub App、Access、Rate Limit、Secrets、Pages変数、利用、障害対応、費用の手順を追加した。
- 要件、基本設計、詳細設計、トレーサビリティ、現状評価、変更履歴、READMEを更新した。

### 検証結果

- 構成検証: 成功。
- 依存取得不要の回帰: 135/135成功。
- Workers strict型検査: 成功。
- クライアント新規サービスstrict型検査: 成功。
- 全TS/TSX 161ファイルの構文変換: 成功。
- アプリ全ローカルimportのesbuild bundle: 成功（外部依存は外部化）。
- 公式`npm ci`はVite 7.3.6取得がHTTP 403となり、公式`npm run check`、Vite build、Chrome E2Eは未実施。
- 実GitHub／Cloudflare、本番接続、iOS実機は未設定・未実施。

### 残課題

- 通常CIで公式`npm run check`を完走する。
- GitHub App／Cloudflare Access／Workersを設定して本番前接続試験を行う。
- iPhone実機のPWA・VoiceOver・文字拡大・オフライン受入を行う。
