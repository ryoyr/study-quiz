# Validation Report — Study Quiz v4.4.0

実施日: 2026-10-06

## 1. 実行結果

|確認|結果|
|---|---|
|構成検証 `node scripts/verify-project.mjs`|成功|
|単体試験 `bun test tests/*.test.ts`|105件成功、失敗0件（23ファイル）|
|ローカルTS/TSX/CSSバンドル構文検証|成功、97モジュール|
|ソース到達性（Bun metafile）|実行時ソース95ファイル到達、未到達は型定義専用8ファイルのみ|
|Service Worker / E2Eスクリプト構文検査|成功|
|JSON構文検査|`package.json`、`package-lock.json`、Manifestすべて成功|
|UTF-8読込み検査|対象テキスト資材をすべて読込み成功|
|PWAアイコン形式・寸法|180 / 192 / 512 / maskable 512pxを確認|
|危険パターン簡易検査|実行時ソースに`window.confirm`、`dangerouslySetInnerHTML`、`eval`、`new Function`、`document.write`なし|

## 2. v4.4.0重点回帰試験

- 共通確認ダイアログが`alertdialog`、モーダル状態、名前・説明を持つこと。
- 取消への初期フォーカス、Tab循環、Escape取消、起点へのフォーカス復帰、背景スクロール抑止を実装していること。
- 問題アーカイブ、AIテンプレート削除、修正提案削除が`window.confirm`へ依存しないこと。
- AIテンプレートカードが入れ子の対話要素を持たないこと。
- 問題編集のID、短文、長文、タグ件数上限がCSV取込制約と整合すること。
- localStorage読込み拒否時にGemini設定が安全な既定値を返すこと。
- 外部AbortSignalによる中止をタイムアウトと区別すること。
- Navigation Preload失敗時の通常fetch継続とCache Storage書込み失敗時のネットワーク応答継続を静的検証すること。
- Service Workerキャッシュ世代v19、Manifest、4種類のPNGアイコンを検証すること。

## 3. 保存互換性確認

- localStorage schema version 8を維持した。
- 既存の物理保存キーを追加・変更・削除していない。
- 完全バックアップ出力version 9、読込みversion 2〜9を維持した。
- IndexedDB database version 2と既存ストアを維持した。
- 新しい確認ダイアログ状態はメモリ上だけに保持し、バックアップ形式へ追加しない。
- Gemini APIキーとUIガイド表示済み状態は従来どおり完全バックアップ対象外である。

## 4. 実行環境上の制約

- `npm ci --no-audit --no-fund`は、実行環境の取得ポリシーによりnpmレジストリからのVite取得がHTTP 403で失敗した。
- そのためロックファイル指定のReact型定義、Vite、ts-fsrsをプロジェクトローカルへ復元できず、公式依存による`tsc -b`と`vite build`は完走していない。
- 代替としてBunの全単体試験、依存を外部化したブラウザー向けバンドル、Node構文検査、JSON検査、構成検証を実施した。
- Chrome / Chromiumが存在しないため、実ブラウザーE2Eは未実行。E2Eシナリオと構文、およびダイアログ要件の静的契約は検証済みである。

依存取得とChrome利用が可能な環境での最終確認コマンド:

```bash
npm ci --no-audit --no-fund && npm run check
```
