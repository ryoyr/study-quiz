# 検証報告 — Study Quiz 4.6.0

## 対象

問題・解説品質向上、JSON入出力、提案レビュー・適用、初期データ更新パック、保存・復元version 10。

## 結果

|検証|結果|詳細|
|---|---|---|
|全単体試験|PASS|161件成功、失敗0件|
|品質入力JSON・プロンプト|PASS|3回答方式、正答定義、問題、解説、出典を含む|
|品質提案JSON|PASS|修正・補足、5MB、10,000件、ID、重複、変更後問題形式を検証|
|提案レビュー|PASS|変更前・提案後、pending/applied/rejectedを区別|
|競合検知|PASS|提案作成後に現在問題が変わった場合は適用停止|
|適用トランザクション|PASS|問題、seed version、提案状態を同時更新|
|完全バックアップ|PASS|quality proposalをversion 10で出力・再読込|
|旧バックアップ|PASS|version 2～10を読込み、version 9以降は整合性検証|
|初期データ更新ツール|PASS|パック形式、初期問題ID、問題形式、重複を検証しoverrideを更新|
|Chrome E2E|PASS|JSON取込、前後レビュー、適用、初期データ更新JSONの実ダウンロード|
|サービスstrict型検査|PASS|TypeScript 5.9.3、ES2023/DOM、Bundler解決|
|TS/TSX構文解析|PASS|143/143ファイル|
|構成・JS・Python構文|PASS|verify-project、E2E、seed tool、PWA icon tool|
|公式`npm ci`|BLOCKED|Vite 7.3.6取得がHTTP 403|
|公式Vite build|BLOCKED|ロック依存を復元できないため未完走|

## データ互換性

- Application: 4.6.0
- localStorage schema: 9
- IndexedDB: 2
- Full backup: 10
- Supported backup input: 2～10
- Service Worker cache: v22
- 既存問題、履歴、APIキー除外方針は維持。

## 一時E2Eビルド

公式Vite依存を取得できないため、Chrome E2Eは製品ソースから生成した一時検証ビルドで実走した。環境内React 19.2.1とテスト専用`ts-fsrs`アダプターを使用し、これらは成果物へ含めない。通常CIでは`npm ci --no-audit --no-fund && npm run check`を最終ゲートとする。
