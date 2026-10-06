# Validation Report — Study Quiz v4.3.0

実施日: 2026-10-06

## 1. 実行結果

|確認|結果|
|---|---|
|構成検証 `node scripts/verify-project.mjs`|成功|
|単体試験 `bun test tests/*.test.ts`|97件成功、失敗0件（21ファイル）|
|ローカルTS/TSX/CSSバンドル構文検証|成功、94モジュール|
|Service Worker / E2Eスクリプト構文検査|成功|
|JSON構文検査|`package.json`、`package-lock.json`、Manifestすべて成功|
|UTF-8読込み検査|対象テキスト資材215ファイルすべて成功|
|PWAアイコン形式・寸法|180 / 192 / 512 / maskable 512pxを確認|
|ソース到達性検査|`src`配下の実装・CSS 102ファイルが`main.tsx`から到達、未参照実装0件|
|禁止・危険パターン簡易検査|実行時ソースに`dangerouslySetInnerHTML`、`eval`、`new Function`、`document.write`なし|
|不要生成物検査|`node_modules`、`dist`、`coverage`、`.vite`、ログ、tsbuildinfo、Bunロックなし|

## 2. v4.3.0重点回帰試験

- 復元候補と現在データを領域単位で比較し、追加・削除・置換・変更なしを集計する。
- 配列形式の領域で現在件数と復元後件数を算出する。
- 破損した現在データを有効な差分として扱わず、復元開始前に拒否する。
- 復元候補の形式・版・単項目・参照関係・チェックサムを既存仕様どおり検証する。
- 確認チェック前は復元ボタンを無効化し、ブラウザー標準確認ダイアログへ依存しない。
- 復元開始直前に`study-quiz-pre-restore-*.json`の安全バックアップを生成する。
- 差分分類を色だけでなく文字ラベルで提示し、狭幅・強制カラーモード用CSSを定義する。
- E2Eシナリオへ互換バックアップ投入、差分表示、確認前後の復元操作可否を追加した。
- Service Workerキャッシュ世代v18、Navigation Preload、Manifest、4種類のアイコンを検証した。

## 3. 保存互換性確認

- localStorage schema version 8を維持した。
- 既存の物理保存キーを追加・変更・削除していない。
- 完全バックアップ出力version 9、読込みversion 2〜9を維持した。
- IndexedDB database version 2と既存ストアを維持した。
- 差分結果は画面表示時に算出し、端末ストレージやバックアップファイルへ保存しない。
- Gemini APIキーとUIガイド表示済み状態は従来どおり完全バックアップ対象外である。

## 4. PWA・配布資材確認

- `manifest.webmanifest`は`id`、`start_url`、`scope`を`./`で統一し、学習・記録・バックアップのショートカットを含む。
- 180px Apple touch icon、192px、512px、maskable 512pxのPNGを同梱した。
- Service Workerは同一origin・scope内GETだけを扱い、Range要求と206応答をキャッシュしない。
- v18 activate時に旧キャッシュを削除し、Navigation Preload失敗時も通常fetchへフォールバックする。

## 5. 実行環境上の制約

- `npm ci --no-audit --no-fund`および`bun install --frozen-lockfile`は、実行環境の取得ポリシーによりnpmレジストリからの依存取得がHTTP 403で失敗した。
- そのためロックファイル指定のReact型定義、Vite、ts-fsrsを復元できず、公式依存による`tsc -b`と`vite build`は完走していない。
- 代替としてBunによる全単体試験と、依存を外部化したブラウザー向けバンドルでローカルimport解決およびTS/TSX/CSS構文を確認した。
- Chrome / Chromiumが存在しないため、実ブラウザーE2Eは未実行。E2Eスクリプトの構文、CI接続、試験シナリオは単体試験と構成検証で確認した。

依存取得とChrome利用が可能な環境での最終確認コマンド:

```bash
npm ci --no-audit --no-fund && npm run check
```
