# 検証報告 — Study Quiz 4.5.1

## 2026-10-11 4.5.1 履歴スナップショット検証

- 回答時点の問題文・方式・回答表示・正答表示を新規履歴へ保存。
- 問題文と選択肢を変更後も、履歴画面が回答時点の内容を表示することを単体試験とChrome E2Eで確認。
- スナップショットなしの旧履歴が現行問題へフォールバックすることを確認。
- 不正なスナップショットを通常読込では除外し、完全バックアップでは復元前に拒否することを確認。
- backup version 9とversion 2～9読込み、storage schema 8、IndexedDB version 2を維持。

## 2026-10-11 継続検証

|検証|結果|詳細|
|---|---|---|
|全単体試験|PASS|151件成功、失敗0件|
|3回答方式Chrome E2E|PASS|CSV登録、3方式回答、表示、履歴、完全バックアップ往復|
|E2E再現性|PASS|独立プロファイルで2回連続成功|
|サービスstrict型検査|PASS|TypeScript 5.9.3、ES2023/DOM、Bundler解決|
|TS/TSX構文解析|PASS|135/135ファイル|
|構成・JS・Python構文|PASS|構成検証、E2Eスクリプト、PWA画像生成スクリプト|
|公式`npm ci`|BLOCKED|公開npm指定でもVite 7.3.6取得がHTTP 403|
|公式Vite build|BLOCKED|ロック依存を復元できないため未完走|

Chrome E2Eは製品ソースから生成した一時検証ビルドで実走しました。ロック依存を取得できなかったため、環境内のReact 19.2.1とテスト専用`ts-fsrs`アダプターを使用しています。これらは成果物へ含めていません。通常CIでは引き続き`npm ci --no-audit --no-fund && npm run check`を最終ゲートとします。

## 1. 基準

- 最新ダンプ: 2026-10-10 23:16:58生成、169テキストファイル
- 安全抽出: 169/169、重複0、空0
- ベースライン構成検証: 12件失敗
- ベースライン単体試験: 118/120成功
- ベースライン失敗原因: PWA画像4件と`tools/generate_pwa_icons.py`がダンプ対象外

## 2. 改良版の検証結果

|検証|結果|詳細|
|---|---|---|
|プロジェクト構成検証|PASS|TypeScript設定、版、PWA資材、回答モデル、現行文書|
|全単体試験|PASS|129件成功、失敗0件|
|全TS/TSX構文変換|PASS|132/132ファイル、esbuild 0.28.1、ES2022|
|改良サービスstrict型検査|PASS|TypeScript 5.9.3、回答モデル、AIアダプター、検証、CSV、保存|
|Python構文|PASS|PWAアイコン生成スクリプト|
|JavaScript構文|PASS|構成検証、E2Eスクリプト|
|未参照ソース監査|PASS|`src` 105ファイル、main到達104、型宣言を除く未到達0|
|差分空白検査|PASS|`git diff --check`|
|PNG形式・寸法|PASS|180、192、512、maskable 512のRGBA PNG|
|公式`npm ci`|BLOCKED|構成済みレジストリ・公開npmレジストリともVite 7.3.6取得がHTTP 403|
|公式`npm run typecheck`|BLOCKED|ロック版依存を復元できないため未完走|
|公式`npm run build`|BLOCKED|上記依存取得制約|
|Chrome E2E|BLOCKED|Chrome/Chromium不在|
|ZIP展開・SHA-256|PASS|166ファイル、内部ハッシュ165/165、圧縮データエラー0|

## 3. 主要回帰範囲

- 旧形式問題を択一として判定。
- 複数選択の順不同完全一致。
- 入力回答のNFKC・空白・大小正規化。
- 3方式のCSV取込、通常保存、完全バックアップ。
- 回答と履歴互換フィールドの双方向変換。
- 回答時点の`answerType`保存・再読込。
- 3方式のAI質問コンテキスト。
- 3方式のファクトチェック回答定義。
- 3方式の類似問題プロンプト、JSON解析、検証。
- 重複選択肢・重複正解・範囲外回答の拒否。
- PWA画像・Service Workerキャッシュv21。
- 既存の保存トランザクション、バックアップ、テーマ、アクセシビリティ試験。

## 4. セキュリティ・データ確認

- `dangerouslySetInnerHTML`、`eval`、`new Function`の新規利用なし。
- 新規の自動外部送信なし。
- Gemini APIキーは完全バックアップ対象外を維持。
- localStorageキー、schema 8、IndexedDB version 2を維持。
- backup version 9、version 2～9読込みを維持。
- FNV-1aは偶発破損検知であり、暗号学的署名ではない。

## 5. 制約

単体試験と静的検証は合格していますが、公式buildと実ブラウザーE2Eは作業環境の制約で未完了です。導入先またはCIで次を必ず実行してください。

```bash
npm ci --no-audit --no-fund && npm run check
```

## 6. ZIP最終検証

- 収録: 166ファイル、18ディレクトリエントリ
- `unzip -t`: エラー0
- 展開後`sha256sum -c`: 165/165成功
- 除外確認: `node_modules`、`dist`、`coverage`、キャッシュ、ログ、VCS情報なし
- ZIP自体のSHA-256は納品時の応答に記載する。
