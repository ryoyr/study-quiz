# GitHub連携改修 現状調査結果

調査対象: `project_dump_full.txt`から復元した175ファイルと、復元後の関連処理。

## 1. 現在の問題データの保存・読込み構造

- 問題型は `src/types/Question.ts` の `Question`。ID、試験枠、カテゴリ、問題文、回答方式、選択肢／許容回答、正解、解説、出典、タグ、ウェイト、難易度、任意の`archivedAt`を持つ。
- 同梱初期問題は `src/data/questions.ts` の100問。品質レビュー適用済み上書きと合成される。
- 実行時の正本はlocalStorageの `study-quiz-questions-v1`。未保存時だけ同梱問題を保存し、seed versionが変わった場合は既存IDを上書きせず不足IDだけ追加する。
- 問題保存は共通`isQuestion`検証、最大100,000問、ID重複拒否、ストレージトランザクションを通る。
- 追加・編集・CSV取込・アーカイブは最終的に同じ`saveQuestions`へ集約される。
- 回答履歴、FSRS状態、メモ、注釈、提案、中断セッションは問題IDを参照する。新しい回答履歴は回答時点スナップショットも保持する。

## 2. GitHubで管理するデータ

- `public/content/manifest.json`
- `public/content/questions/*.json`
- 問題の配布原本、データセット版、全体content version、更新日時、件数

問題JSONは現行`Question`をそのまま使用する。GitHub連携だけのためにID・回答形式・カテゴリを変換しない。

## 3. GitHubで管理しないデータ

- 回答履歴
- FSRSカード、理解度、復習予定
- 設定、非学習日、テーマ
- 中断セッション
- 間違いノート、お気に入り、個人メモ
- Gemini APIキー
- 端末内だけの編集途中状態
- バックアップファイル

## 4. 問題マスター分離に必要な変更

- 現行100問をデータセットJSONへ出力する。
- マニフェストとデータセットを実行時に検証する。
- 前回配布元の問題フィンガープリントを保持し、端末編集と配布元更新を区別する。
- 配布元削除は問題ID参照を保つため物理削除せずアーカイブする。
- PWAは問題マスターをnetwork-firstで取得し、通信失敗時だけ直近キャッシュへ戻す。

## 5. 既存機能への影響

- `Question`、問題ID、`study-quiz-questions-v1`は変更しない。
- storage schemaは9、IndexedDB versionは2、完全バックアップversionは10を維持する。
- 問題マスター同期状態は再取得可能な補助情報としてRegistryへ登録し、バックアップ対象外とする。
- 学習・履歴・FSRS・CSV・バックアップは従来の`storedQuestions`を使い続ける。
- Workers未設定、オフライン、認証切れでも既存機能を停止しない。

## 6. 変更ファイルと理由

- `public/content/**`: GitHubでレビュー可能な問題原本。
- `src/types/QuestionMaster.ts`: マニフェスト、同期、変更、API契約。
- `src/services/questionMasterService.ts`: 取得、検証、安全マージ。
- `src/services/questionMasterChangeService.ts`: 追加・更新・アーカイブ差分と冪等キー。
- `src/services/contentPullRequestApi.ts`: Workersとの限定API通信。
- `src/pages/QuestionMasterPage.tsx`: 差分、確認、送信、PR状態、同期競合UI。
- `workers/quiz-content-pr/**`: Access認証、認可、GitHub App、Git Data API、PR作成。
- `public/sw.js`: 問題マスターのnetwork-first。
- `tests/*QuestionMaster*`, `tests/contentPullRequestApi.test.ts`, `tests/worker*.test.ts`: 新規境界の回帰試験。

## 7. Cloudflare Workers側に必要な処理

- Cloudflare Access JWTの署名、issuer、AUD、有効期限、利用者メール検証
- 許可オリジン、許可メール、レート制限、2MiB上限、厳格JSON検証
- リポジトリ、ベースブランチ、管理ルートのサーバー側固定
- GitHub App installation access token取得
- ベースSHA固定、マニフェスト版・問題フィンガープリント競合確認
- blobs、tree、commit、専用ref、Pull Requestの順に作成
- 同一内容の再送回収、エラーの安全な整形

## 8. GitHub側に必要な設定

- GitHub Appを対象リポジトリだけへインストール
- Repository permissions: Contents `Read and write`、Pull requests `Read and write`、Metadata `Read-only`
- main保護: Pull Request必須、必要に応じ承認・`npm run check`必須、force push・branch deletion禁止
- ActionsのRepository variable `QUIZ_CONTENT_API_URL`

## 9. 認証情報の管理

- GitHub App ID、installation ID、private keyはWorkers Secrets。
- ブラウザーへ渡すのはWorkersのHTTPS URLだけ。
- AccessアプリのAUDと許可メールはWorkers変数。秘密鍵・installation tokenは応答、ログ、localStorage、IndexedDB、Vite環境変数へ保存しない。

## 10. 実装・テスト・デプロイ手順

1. `npm ci --no-audit --no-fund`
2. `npm run check`
3. Workersで`npm ci`、`npm run typecheck`
4. GitHub AppとAccessを設定し、Secretsを登録
5. Workersをデプロイ
6. GitHub variableへWorkers URLを登録してPagesを再デプロイ
7. テスト用変更でPRを作成し、mainへ直接コミットされていないことを確認
8. PRをマージし、Pagesデプロイ後にアプリで最新マスターを確認・安全適用
