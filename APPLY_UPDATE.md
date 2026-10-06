# Study Quiz v4.4.0 上書き適用手順

## 1. 適用前

1. アプリの「完全バックアップ」からブラウザー内データを保存する。
2. 開発サーバーを停止する。
3. 既存プロジェクトディレクトリを別名で退避する。

## 2. 適用

ZIPはプロジェクトルート基準です。`package.json`がある既存`study-quiz`ディレクトリへ全内容を展開し、同名ファイルを上書きしてください。

Windows PowerShell（ZIPとプロジェクトが同じ親ディレクトリにある場合）:

```powershell
Expand-Archive -LiteralPath '.\study-quiz-v4.4.0-overwrite.zip' -DestinationPath '.\study-quiz' -Force
```

既存プロジェクトに残るファイルは削除しません。今回の更新では削除必須ファイルはありません。

## 3. 依存関係と検証

```bash
npm ci --no-audit --no-fund && npm run check
```

Chrome/Chromiumを自動検出できない場合は、`CHROME_PATH`または`BROWSER_EXECUTABLE`に実行ファイルを指定して`npm run test:e2e`を実行してください。

## 4. 互換性

- localStorage schemaは8のままで、既存キーを変更しません。
- IndexedDB database versionは2のままです。
- 完全バックアップはversion 2〜9を読込み可能です。
- 新規出力はversion 9で、FNV-1aチェックサム形式を維持します。
- v4.3.0からのデータ移行は不要です。
- Gemini APIキーと初回ガイド表示済み状態はバックアップしません。

## 5. 主な確認ポイント

- 問題のアーカイブ、AIテンプレート削除、修正提案削除で専用確認ダイアログが表示される。
- 確認ダイアログは取消へ初期フォーカスし、Escapeで閉じ、閉じた後は操作元へ戻る。
- 問題編集で長大な入力や過剰なタグが拒否される。
- オフライン起動、更新通知、PWAショートカットが従来どおり動作する。
- バックアップ出力と復元前差分確認が従来どおり動作する。

詳細は`UPGRADE_REPORT.md`と`VALIDATION_REPORT.md`を参照してください。
