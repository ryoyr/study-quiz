# Validation Report — Study Quiz v4.1.0

実施日: 2026-10-06

## 1. 実行結果

|確認|結果|
|---|---|
|構成検証 `node scripts/verify-project.mjs`|成功|
|単体試験 `bun test tests/*.test.ts`|82件成功、失敗0件|
|ローカルTS/TSX/CSSバンドル構文検証|成功、90モジュール|
|Service Worker構文検査 `node --check public/sw.js`|成功|
|JSON構文検査|成功|
|PWAアイコン形式・寸法|180 / 192 / 512 / maskable 512pxを確認|
|ソース到達性検査|`src`配下96ファイル中96件到達、未参照0件|
|禁止・危険パターン簡易検査|`dangerouslySetInnerHTML`、`eval`、`new Function`、`document.write`なし|
|E2Eスクリプトの異常終了性|Chrome未導入時に即時終了し、HTTPサーバーを残さないことを確認|

## 2. 追加した重点回帰試験

- 現行ストレージschema version 8を含む完全バックアップをversion 9として自己再読込できる。
- version 9バックアップのentries変更をチェックサム不一致として拒否する。
- 端末内データ診断が正常データと破損JSONを識別する。
- localStorage書込みが例外なく欠落した場合も読戻し検証で検知し、元データへ戻す。
- Manifestに完全バックアップへのPWAショートカットが存在する。
- Service Workerが任意資材を`Promise.allSettled`で取得し、Range要求を除外する。
- E2Eシナリオにバックアップ画面の直接起動、健全性確認、出力ボタン活性確認が含まれる。

## 3. 依存なしで実行したバンドル検証

公式依存を外部モジュール扱いにし、Bunでアプリ配下90モジュールを走査・変換した。これにより今回変更したTS/TSXを含むローカルimport解決、構文、CSS取り込みを確認した。これは公式依存を用いるVite本番ビルドの代替ではない。

## 4. 環境上の制約

`npm ci --no-audit --no-fund`および`bun install --frozen-lockfile`は、実行環境の取得ポリシーによりnpmパッケージtarballへのHTTP 403で失敗した。このため指定版のReact型定義、Vite、ts-fsrsを復元できず、公式依存による`tsc -b`、`vite build`、実ブラウザーE2Eは完走していない。

Chrome/Chromiumも実行環境に存在しない。E2Eスクリプト自体は、従来のように試験用HTTPサーバーを残して待機せず、明確なエラーで終了するよう修正した。

依存取得とChrome利用が可能な環境での最終確認コマンド:

```bash
npm ci --no-audit --no-fund && npm run check
```
