# TEST REPORT — クイズアプリ総合改良

検証日: 2026-10-11

## 1. 結果要約

|領域|結果|備考|
|---|---:|---|
|AI JSON抽出・限定修復・最大3回再生成|PASS|5追加試験|
|類似問題・品質提案schema／整合性|PASS|既存＋追加回帰|
|問題改訂履歴・backup登録|PASS|ID維持、before/after、参照検証|
|改行・段落・箇条書き安全表示|PASS|HTML挿入なし|
|DB正本判断・IndexedDB派生cache|PASS|GitHub単独正本、DB v3 cache|
|Service Worker v24|PASS|network-first、明示消去|
|全既存・追加単体試験（補助環境）|214/214 PASS|共有tsx＋一時ts-fsrs adapter|
|重点・セキュリティ回帰|58/58 PASS|PWA、Access、PR冪等性を含む|
|変更サービスstrict TypeScript|PASS|隔離tsconfig|
|Worker strict TypeScript|PASS|既存設定|
|フロント全import／bundle|PASS|esbuild、第三者runtimeを解決／外部化|
|構成検証|PASS|計画・実装・PWA・Worker資材|
|Chrome E2E|PASS|品質JSON旅程を含む全E2E|
|秘密情報検査|PASS|秘密値パターン0|
|公式npm依存取得|BLOCKED|Vite 7.3.6 HTTP 403|

## 2. 追加試験

### AI JSON

- Markdown fenceと前後説明からbalanced JSONを抽出。
- JSON文字列内のカンマ・括弧を保持。
- 文字列外の末尾カンマだけを修復。
- schema不一致を最大3回再生成。
- 3回失敗時に保存せずエラー。

### revision・表示

- 問題ID維持。
- before／afterと変更項目。
- localStorage往復。
- registryとfull backup validator。
- 改行、段落、箇条書きをReact要素化。
- `dangerouslySetInnerHTML`不使用。
- 編集preview・履歴UI。

### DB・PWA

- IndexedDB v3と`questionMasterCache`。
- `QUESTION_MASTER_AUTHORITY = github-content`。
- remote成功後cache、remote失敗時だけ検証済みcache fallback。
- SW v24、content network-first、`CLEAR_CONTENT_CACHE`。

### 既存回帰

- 3回答方式、履歴、FSRS、バックアップ、設定、ストレージtransaction。
- 品質提案、seed update、一括ファクトチェック、類似問題。
- Cloudflare Access JWT、Origin、許可メール、Rate Limit。
- GitHub PR 1 commit、競合、再送冪等性、main直接更新なし。

## 3. 公式コマンド

|コマンド|exit|結果|
|---|---:|---|
|`npm ci --no-audit --no-fund`|1|Vite 7.3.6 tarballがHTTP 403|
|`npm run typecheck`|1|lock依存未取得。React型、ts-fsrs、Vite型を解決不能|
|`npm test`|127|ローカルtsx未取得|
|`npm run build`|1|型検査で停止、Viteへ未到達|
|`npm run check`（文書追加後再試行）|127|構成検証成功後、`tsx`未取得で停止|
|`npm run test:e2e`（一時製品相当bundle）|0|実Chromeで全E2E成功|

公式依存を取得できない環境制約を成功扱いにしていない。

## 4. 代替検証

- 共有TypeScriptと隔離宣言による変更サービスstrict型検査。
- Worker既存strict tsconfig。
- 共有tsx 4.21.0と一時`ts-fsrs`runtime adapterによる全214試験。
- esbuildで全ローカルimportをbundle。
- React／React DOMと一時adapterを解決した製品相当bundleでChrome E2E。

一時adapter、隔離宣言、bundle、`node_modules`、`dist`は成果物へ含めない。adapterはFSRSライブラリ固有の計算精度を保証せず、module解決とアプリ回帰だけを検証する。

## 5. Chrome E2E

成功範囲:

- 3回答方式のCSV登録、回答、履歴、backup往復。
- 品質提案JSON入出力契約、取込、before/after、適用、seed update download。
- 10画面、10テーマ、320×568、393×852。
- 確認dialog、contrast、横scroll、fixed UI、validation、keyboard、AX tree。

## 6. データ保全

作業前後で同一:

|対象|SHA-256|
|---|---|
|`public/content/manifest.json`|`ca04f01af6f465278e45b0b8eeb76e7d1ee217bb46bde154f1a2892f172ac36d`|
|`public/content/questions/lpic-101.json`|`e763322525436e163ad6882d11310a89fd2cc546a19a4aef064d81da9b98ed5e`|
|`src/data/questions.ts`|`6156640938994855af22a136366d4a9e79cd6afbfd3a710659d0523f04df89ac`|

次の型・Worker実装も直前版と同一:

- StudyHistory
- QuestionAnnotation
- Setup
- Worker auth、GitHub client、index

## 7. セキュリティ

- private key、Access service secret、実Gemini API keyらしき値: 0件。
- Gemini API keyはbackup対象外。
- GitHub App秘密値はWorker Secret前提を維持。
- 実GitHub API、本番DB、Cloudflare設定へ書込みなし。
- HTML直接挿入なし。

## 8. 未実施

- 公式lock依存による`npm run check`完走: registry HTTP 403。
- 実PostgreSQL／D1／Supabase作成とmigration: DB・認可・rollback未決定かつ不可逆操作禁止。
- 実GitHub PR: ユーザー指示により禁止。
- 実本番DB書込み・データ削除: 禁止。

## 9. リリース条件

依存取得可能な通常CIで次を完走する。

```bash
npm ci --no-audit --no-fund && npm run check
```

DB正本化は`docs/question-master-authority-assessment.md`の条件を満たす別リリースとする。

## 10. ZIP検証

最終パッケージ作成後に、内部SHA、zip test、展開後SHA、構成、秘密情報、重点試験を実施し、結果をRelease Manifestへ記録する。


## 11. 成果物検証

- パッケージ: 230ファイル（`SHA256SUMS_COMPLETE.txt`を含む）。
- 内部SHA-256: 229/229成功。
- ZIP圧縮データ検査: エラー0。
- 展開後SHA: 229/229成功。
- 展開後構成、変更サービス型、Worker型、E2E／SW構文: 成功。
- 展開後重点・PWA・Access／GitHub試験: 42/42成功。
- 展開後秘密情報パターン検査: 0件。
