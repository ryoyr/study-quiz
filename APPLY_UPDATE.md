# Study Quiz v4.1.0 上書き適用手順

## 適用前

1. 既存プロジェクトとブラウザー内データの完全バックアップを取得する。
2. 開発サーバーを停止する。
3. 既存プロジェクトディレクトリを別名で退避する。

## 適用

このZIPはプロジェクトルート基準で格納している。既存`study-quiz`のルート（`package.json`がある場所）へ全内容を展開し、同名ファイルを上書きする。

Windows PowerShell（ZIPとプロジェクトの親ディレクトリで実行）:

```powershell
Expand-Archive -LiteralPath '.\study-quiz-v4.1.0-overwrite.zip' -DestinationPath '.\study-quiz' -Force
```

## 検証

```bash
npm ci --no-audit --no-fund && npm run check
```

## 互換性

- localStorage schemaは8のままで、既存キーを変更しない。
- 完全バックアップversion 2〜8を読込み可能。
- 新規出力はversion 9で、破損検知用チェックサムを持つ。
- APIキーと初回ガイド表示済み状態はバックアップしない。

詳細は`UPGRADE_REPORT.md`と`VALIDATION_REPORT.md`を参照する。
