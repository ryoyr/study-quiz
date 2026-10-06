# Study Quiz v4.4.0 E2Eアクセシビリティ修正

## 適用方法

既存の `study-quiz` プロジェクトルートで、このZIPを展開して同名ファイルを上書きしてください。

PowerShell（プロジェクトルートで実行）:

```powershell
Expand-Archive -LiteralPath .\study-quiz-a11y-fix-20261007.zip -DestinationPath . -Force
```

適用後の確認:

```powershell
npm ci --no-audit --no-fund; if ($LASTEXITCODE -eq 0) { npm run check }
```

## 修正内容

1. 問題管理の確認ダイアログ
   - モーダル開始・終了処理を `useLayoutEffect` で同期し、取消ボタンへ初期フォーカスを即時設定。
   - 終了時に元の `body.style.overflow` と起点要素のフォーカスを描画確定時に復旧。
   - アーカイブ起点ボタンを明示的にフォーカスしてから確認ダイアログを開き、プログラム操作でも復帰先を確定。

2. 完全バックアップ画面の横スクロール
   - 差分一覧コンテナへ誤適用されていた直下 `div` の横並び指定を、一覧行だけへ限定。
   - 狭幅Gridの列を `minmax(0, 1fr)` とし、カードと固定ヘッダーの最大幅をViewport内へ制限。
   - 問題管理の検索・絞り込み入力も縮小可能にし、320px幅での副次的な横超過を防止。

## 互換性

- アプリバージョン: 4.4.0（変更なし）
- localStorageスキーマ: 8（変更なし）
- IndexedDBバージョン: 2（変更なし）
- 完全バックアップ形式: version 9、version 2〜9読込み（変更なし）
- 保存キー、データ移行、依存関係、Service Worker、PWAアイコンは変更なし

## 検証結果

- 構成検証: 成功
- 単体試験: 107件成功、失敗0件
- プロダクションバンドル: 成功（代替環境のVite 8.0.16、109モジュール）
- E2Eアクセシビリティ試験: 成功（10画面、320x568・393x852）
- `npm run typecheck` / `npm run build` / `npm run check`: 実行を試みたが、実行環境のnpmレジストリ制限（HTTP 403）によりロックファイル指定の `@types/react` 等を取得できず、完全実行不可。型構文はバンドル時に検証済み。

注: 元ダンプではPWA画像とWeb Manifestの内容が省略されていたため、単体試験時のみ同寸法の一時資材を生成した。これらは本ZIPに含めていない。
