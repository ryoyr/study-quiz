# テーマ／アクセシビリティ強化パッチ 適用手順

## 対象

- 基準: `project_dump.txt` の Study Quiz v4.4.0
- 形式: 既存プロジェクトへ同名ファイルを上書きする差分ZIP
- 保存データ: localStorage schema 8、IndexedDB version 2、完全バックアップ version 9を変更しない

## 適用前

1. アプリの「完全バックアップ」からブラウザー内データを保存する。
2. 開発サーバーを停止する。
3. 既存プロジェクトを別名で退避する。

## 適用

ZIPを既存の `study-quiz` プロジェクトルートへ展開し、同名ファイルを上書きする。

PowerShell（プロジェクトルートで実行）:

```powershell
Expand-Archive -LiteralPath '.\study-quiz-theme-accessibility-20261007.zip' -DestinationPath '.' -Force
```

## 適用後の確認

依存関係を取得できる環境で、次を実行する。

```powershell
npm ci --no-audit --no-fund; if ($LASTEXITCODE -eq 0) { npm run check }
```

必要に応じて各工程を個別実行する。

```powershell
npm run typecheck; npm run test; npm run build; npm run test:e2e
```

## 主な変更

- オーロラ、フォーカス、フォレスト、サンセット、モノクロのライト／ダーク用トークンを整備。
- 背景、面、カード、フォーム、ボタン、選択、ホバー、フォーカス、モーダル、ナビゲーション、ステータス、表、バッジ、警告・成功・エラー、無効状態をセマンティック変数へ統合。
- グラフ系列をテーマ連動色へ変更し、破線・点線・二重線を併用して色だけに依存しない表示へ改善。
- `forced-colors`、`prefers-reduced-motion`、キーボードフォーカス、320〜393px狭幅表示を補強。
- E2Eへ5テーマ×2明暗のコントラスト検査を追加。

詳細は `THEME_ACCESSIBILITY_REPORT.md` を参照すること。
