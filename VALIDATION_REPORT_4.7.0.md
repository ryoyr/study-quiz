# 検証報告 — Study Quiz 4.7.0 GitHub integration

検証日: 2026-10-11

## 1. 結果要約

|区分|結果|備考|
|---|---:|---|
|最新ダンプ復元|成功|2026-10-11 03:05:15生成、193/193テキスト、パストラバーサルなし|
|完全版資材補完|成功|ダンプ対象外18件を直前完全版ZIPから復元し、最新ダンプの共通ファイルを優先|
|構成検証|成功|4.7.0、PWA、問題マスター、Workers必須資材|
|seed更新ツール対象回帰|成功|5/5。空白パス、既存保持、未知ID、重複、Question制約、ID不一致|
|共有tsx全テスト試行|一部成功|139/145成功、6スイートは`ts-fsrs`未取得で起動失敗|
|公式`npm ci`|失敗（環境制約）|Vite 7.3.6 tarball取得がHTTP 403|
|`npm run typecheck`|失敗（環境制約）|ロック依存未取得。React型、`ts-fsrs`、Vite型を解決不能|
|`npm test`|失敗（環境制約）|ローカル`tsx`未取得、exit 127|
|`npm run build`|失敗（環境制約）|型検査で停止しViteへ未到達|
|`npm run check`|失敗（環境制約）|構成検証成功後、`tsx`未取得で停止|
|Chrome E2E|未実施|`npm run check`が単体試験段階で停止|
|実GitHub／Cloudflare接続|未設定・未実施|モックのみ。完了扱いにしない|
|iOS実機|未実施|VoiceOver、PWA更新、オフライン受入が必要|

## 2. 実行内容

### 2.1 構成

```bash
node scripts/verify-project.mjs
```

結果: 成功。

確認項目:

- package／lock／backup serviceの4.7.0整合
- storage schema 9、backup 10の維持
- PWA PNG 4件と寸法
- Service Worker v23
- `public/content`のmanifest／dataset ID・version・件数
- Workers、設定文書、調査・進捗文書
- クライアントにGitHub private key／installation IDがないこと

### 2.2 単体・契約・回帰

取得不能な`ts-fsrs`へ到達する6スイートを除き、共有済みtsxランナーで実行。

結果: **135/135成功**。

主な新規観点:

- manifest／dataset検証、パストラバーサル・重複ID拒否
- 初回同期でも端末編集を上書きしない
- 安全更新、配布削除のアーカイブ化、競合保持
- 追加・更新・アーカイブ差分、変更フィールド、決定的SHA-256冪等キー
- HTTPS限定、Cookie認証、安全なAPIエラー、GitHub URL検証
- Access JWTのRS256署名、issuer、AUD、期限、許可メール
- Origin、Rate Limit、2MiB、任意リポジトリ／パス指定拒否
- base version、dataset version、問題フィンガープリント競合
- 複数ファイル1コミット、専用ブランチ、PR作成
- コミット失敗、PR失敗後再送、同一PR回収
- main直接更新・自動マージ処理がないこと
- UIの前後差分、明示確認、PR URL、open／closed／merged
- PWA問題マスターnetwork-firstと非2xx／通信失敗時キャッシュfallback
- 既存の問題保存、3回答方式、履歴、設定、ストレージ、テーマ等

### 2.3 全テスト試行

```bash
npm test
```

は依存未取得のため実行できなかった。代替として共有tsxランナーで全ファイルを試行し、**132件成功、6スイートが起動時失敗**した。失敗はすべて`ts-fsrs`を解決できない`ERR_MODULE_NOT_FOUND`で、テストアサーション失敗ではない。

該当スイート:

- `importAndBackup.test.ts`
- `questionQualityService.test.ts`
- `questionStateService.test.ts`
- `resilience.test.ts`
- `storageKeyRegistry.test.ts`
- `studySelectionAndTrend.test.ts`

これらを「成功」とは扱わない。通常CIで`npm ci`後に再実行する。

### 2.4 型・構文・bundle

```bash
node <TypeScript 5.9.3 tsc> -p workers/quiz-content-pr/tsconfig.json
```

結果: 成功。

```bash
node <TypeScript 5.9.3 tsc> -p feature-tsconfig.json
```

結果: 成功（クライアント新規サービス）。

TypeScript `transpileModule`による全161 TS/TSX構文変換: エラー0。

esbuildで`src/main.tsx`から全ローカルimportをbundleし、React、React DOM、ts-fsrsのみ外部化: 成功。これは公式Vite build／strict app型検査の代替ではない。

## 3. 依存取得失敗

実行した2方式:

```bash
npm ci --no-audit --no-fund
```

```bash
npm ci --no-audit --no-fund --registry=https://registry.npmjs.org/
```

どちらもVite 7.3.6のtarball取得でHTTP 403。前者は組織proxy、後者はnpmjs直指定でも同じ環境ポリシーで拒否された。ソースやlockを変更して回避していない。

## 4. 互換性確認

- `Question`フィールドとIDを変更していない。
- `study-quiz-questions-v1`を変更していない。
- storage schema 9、IndexedDB version 2、backup version 10を変更していない。
- backup 2～10の読込みコードを変更していない。
- GitHub連携状態は新しいRegistry keyだが、再取得可能な補助情報のためbackup対象外。
- 配布元削除は端末でアーカイブし、履歴・FSRSのquestionId参照を維持する。
- Workers未設定・通信失敗でも問題編集と学習は従来どおり端末内で継続する。

## 5. 本番前に必須の未実施ゲート

1. 通常のnpm取得可能環境で`npm ci --no-audit --no-fund`。
2. `npm run check`完走（全単体、strict app型検査、Vite build、Chrome E2E）。
3. Workers側でpackage-lock生成・レビュー後、`npm ci && npm run typecheck`。
4. GitHub App、Cloudflare Access、Rate Limiting、Secrets、custom domainを設定。
5. テスト用リポジトリまたはテスト変更で実API接続を確認。
6. main SHAがPR作成だけでは変わらず、手動マージ後だけ変わることを確認。
7. GitHub Pagesデプロイ後のmanifest更新、キャッシュ、競合、オフラインを確認。
8. iPhone実機でホーム画面PWA、VoiceOver、文字拡大、更新、オフラインを受入。

## 6. 判定

- **実装済み**: 問題マスター、差分・確認UI、APIクライアント、Workers、認証・認可・競合・冪等化、PWAキャッシュ、設定文書。
- **モックテスト済み**: GitHub／Cloudflare境界を含む新機能。
- **本番設定済み**: いいえ。
- **本番接続確認済み**: いいえ。
- **リリース可否**: 通常CIの`npm run check`と本番前接続試験の完了を条件とする。

## 7. TypeScript TS2430 remediation（2026-10-11）

### 修正

- `contentPullRequestApi.ts`の`interface ViteImportMeta extends ImportMeta`を削除。
- `ImportMeta & { readonly env: ... }`の交差型`ContentApiImportMeta`へ変更。
- `vite-env.d.ts`は`moduleDetection: force`でもグローバル宣言マージされるよう、`export {}`と`declare global`で`ImportMetaEnv.VITE_QUIZ_CONTENT_API_URL?: string`を定義。
- `tsconfig.node.json`側のテストがサービスを直接importしても、独自`ImportMeta`継承や`ImportMetaEnv`への依存で失敗しない構造にした。

### 検証

|検証|結果|
|---|---:|
|TypeScript 5.9.3／Vite client型を使った修正対象strict型検査|成功|
|`npm run typecheck`（`tsc -b`、当時の隔離補助環境）|成功|
|APIクライアント・再発防止契約試験|6/6成功|
|Workers strict型検査|成功|
|全TS/TSX構文変換|161/161成功|
|構成検証|成功|

パッケージ取得は引き続き環境ポリシーでHTTP 403となるため、`npm run typecheck`の検証時だけ、取得済みTypeScript 5.9.3・Vite client型と隔離したローカル宣言を`node_modules`配下へ配置した。これらの補助宣言と`node_modules`は成果物に含めていない。TS2430の最小再現を含む修正対象は実Vite client型でもstrict型検査に成功している。

## 8. seed更新ツール修正の再検証（2026-10-11）

### 8.1 入力と復元

- 入力: `project_dump_full.txt`（2026-10-11 03:05:15生成、193テキストファイル）。
- ダンプをパストラバーサルなしで193/193復元した。
- `SHA256SUMS_COMPLETE.txt`の一覧と照合すると、PWA PNG 4件、`tools` 3件、Workers 11件の計18件がダンプに含まれていなかった。
- 直前完全版`study-quiz_v4.7.0_typecheck-fixed.zip`から欠落18件だけを補完し、ダンプに存在する193件はすべて最新ダンプ側を優先した。

### 8.2 失敗原因

1. ダンプ単体には`tools/apply_question_seed_updates.mjs`がなく、`questionSeedUpdateTool.test.ts`は`cpSync`で`ENOENT`になり得る状態だった。
2. 完全版に含まれる旧ツールは`new URL(import.meta.url).pathname`をそのままファイルパスにしていた。配置先に空白があると`%20`が復号されず、`src/data/questions.ts`を見つけられないことを再現した。
3. 旧テストの一時ディレクトリ名には空白がなく、上記不具合を検出できなかった。またツールの参照元が作業ディレクトリ依存だった。
4. 旧ツールのQuestion検証は一部フィールドだけで、回答方式固有制約、重複選択肢、正答範囲、weight、difficultyなどを検証していなかった。
5. 更新パックの内容でoverride配列全体を置換するため、パックに含まれない既存上書きを失う可能性があった。

### 8.3 修正内容

- `fileURLToPath(import.meta.url)`でツール自身のパスを安全に復号し、プロジェクトルートを決定。
- JSON 5MiB、10,000件、パックメタデータ、日時、更新前後IDを検証。
- アプリ共通のQuestion制約に合わせ、3回答方式、選択肢、正答、タグ、weight、difficulty、archive日時を検証。
- 既存`questionQualityOverrides.ts`を検証してマージし、ID順の決定的出力に変更。
- 一時ファイルを同一ディレクトリへ書き、成功時だけrenameし、失敗時は一時ファイルを除去。
- テストは`import.meta.url`基準でツールを取得し、実行時CWDを分離。空白パス、既存保持、未知ID、重複、Question制約違反、更新前ID不一致を追加。

### 8.4 実行結果

|コマンド|exit|結果|
|---|---:|---|
|`node --check tools/apply_question_seed_updates.mjs`|0|成功|
|`node --test tests/questionSeedUpdateTool.test.ts`|0|5/5成功|
|`node scripts/verify-project.mjs`|0|成功|
|`python3 -m py_compile tools/generate_pwa_icons.py`|0|成功|
|`npm ci --no-audit --no-fund`|1|Vite 7.3.6取得がHTTP 403|
|`npm run typecheck`|1|ロック依存未取得。React型、`ts-fsrs`、Vite型を解決できず失敗|
|`npm test`|127|`tsx: command not found`|
|`npm run build`|1|型検査で停止、Vite build未到達|
|`npm run check`|127|構成検証は成功、`npm test`で停止|

補助確認として共有済みtsx 4.21.0で全テストを試行し、**139/145成功**。失敗6件はすべて`ts-fsrs`の`ERR_MODULE_NOT_FOUND`によるスイート起動失敗で、アサーション失敗ではない。成果物へ共有ランナー、代替依存、`node_modules`、検証ログは含めない。

### 8.5 判定

seed更新ツール修正の対象回帰と構成検証は成功した。公式のtypecheck、全単体、build、check、Chrome E2Eは、ロック依存を取得できる通常CIでの完走を必須とし、今回の環境では成功扱いにしない。

### 8.6 成果物整合性

- パッケージ: 211ファイル（`SHA256SUMS_COMPLETE.txt`を含む）。
- 内部SHA-256: 210/210成功。
- ZIP圧縮データ検査: エラー0。
- 展開後SHA-256: 210/210成功。
- 展開後構成検証: 成功。
- 展開後seed更新ツール対象回帰: 5/5成功。
