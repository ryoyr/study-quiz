# FL01 問題CSV

## 1. 文字コード・形式
- UTF-8（BOM可）、RFC 4180相当のカンマ区切り。
- 1ファイル20,000データ行まで。
- カンマ・改行・引用符を含む値はダブルクォートで囲む。

## 2. 列
|列|必須|説明|
|---|---|---|
|id|○|一意な問題ID|
|examScopeId||試験枠ID。省略時 `lpic101`|
|category|○|Topic（例: `103 GNUとUNIXコマンド`）|
|subcategory||Objective（例: `103.1 コマンドライン`）|
|text|○|問題文|
|choice1〜choice8|choice1,2必須|選択肢|
|answer|○|正解番号（1開始）|
|explanation||解説。未入力は警告|
|source||出典。未入力は警告|
|tags||`|` または `、` 区切り|
|weight||正数。省略時1|
|difficulty||1〜5。省略時1|

## 3. 取込規則
- 既存ID・CSV内IDの重複はエラー。
- 不明列、必須列不足、選択肢外の正解番号はエラー。
- 登録前に行単位のプレビューを表示する。
- 例はルートの `sample_questions.csv` を参照する。

