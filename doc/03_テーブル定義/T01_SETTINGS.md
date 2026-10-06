# T01_SETTINGS テーブル定義書

## 1. 概要
- 物理媒体: IndexedDB `exams` / `days` / `settings`、localStorage互換領域
- 設定は保存時に正規化し、旧形式の不足項目へ既定値を補う。

## 2. 項目定義
|No|項目ID|型|必須|説明|
|---:|---|---|---|---|
|1|examId|string|○|設定レコードID。`lpic101`|
|2|name|string|○|ホームに表示する試験名|
|3|examDate|date|○|試験日|
|4|dailyNewLimit|number|○|日次新規上限|
|5|dailyQuestionLimit|number|○|日次総上限|
|6|bufferRate|number|○|バッファ率|
|7|instantThresholdSeconds|number|○|即答閾値|
|8|dailyMinimumQuestions|number|○|最低問題数|
|9|reservedDates|string[]||個別の非学習日|
|10|reservedWeekdays|number[]||毎週の非学習曜日|
|11|examScopeId|string|○|既定の試験枠|
|12|defaultCategory|string|○|既定トピック。`ALL`可|
|13|defaultCategories|string[]|○|既定トピックの複数選択。全範囲は `["ALL"]`。旧データは `defaultCategory` から移行|
|14|defaultMasteryFilter|enum|○|旧版互換用単一値。複数選択時は `ALL`|
|15|defaultMasteryFilters|enum[]|○|理解度の複数選択。`ALL` または `UNLEARNED` / `LEARNING` / `MASTERED` の1件以上|
|16|defaultQuestionMode|enum|○|旧版互換用単一値。複数選択時は `ADAPTIVE`|
|17|defaultQuestionModes|enum[]|○|出題方法の複数選択。`ALL` または `ADAPTIVE` / `NEW` / `REVIEW` / `WEAK` の1件以上|
|18|defaultQuestionIds|string[]|○|既定の個別問題。空配列は条件一致全体|
|19|theme|enum|○|`system` / `light` / `dark`|
|20|visualTheme|enum|○|`aurora` / `focus` / `forest` / `sunset` / `mono`|
|21|setupCompleted|boolean|○|初回設定完了|
|22|createdAt|datetime|○|作成日時|
|23|updatedAt|datetime|○|更新日時|

## 3. 制約
- 試験日は当日以降。
- 日次総上限は日次新規上限以上。
- 個別問題IDは重複不可。
- `defaultCategories` は `["ALL"]` または1件以上の実在トピックを保持し、`ALL` と個別トピックは混在させない。
- `defaultMasteryFilters` と `defaultQuestionModes` は空配列を禁止し、`ALL` と他項目を混在させない。
- 旧形式の単一値は対応する複数値配列へ移行し、不足値はLPIC-1 101、全範囲、おすすめ、端末連動、オーロラ配色へ補完する。
