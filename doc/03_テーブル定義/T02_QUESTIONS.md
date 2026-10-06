# T02_QUESTIONS テーブル定義書

## 1. 概要
- 物理媒体: localStorage互換領域
- 試験枠は `EXAM_SCOPES`、トピックは `category`、objectiveは `subcategory` で表す。
- 論理削除（アーカイブ）により履歴参照を維持する。

## 2. 項目定義
|No|項目ID|型|キー／索引|必須|説明|
|---:|---|---|---|---|---|
|1|id|string|PK|○|問題ID|
|2|examScopeId|string|FK|○|`EXAM_SCOPES.id`。既定 `lpic101`|
|3|category|string||○|Topic 101〜104|
|4|subcategory|string|||Objective 101.1〜104.7|
|5|text|string||○|問題文|
|6|choices|string[]||○|選択肢2～8件|
|7|answerIndex|number||○|正解位置（0開始）|
|8|explanation|string||○|解説|
|9|source|string|||出典・作問根拠|
|10|tags|string[]|||検索タグ|
|11|weight|number||○|重要度（正数）|
|12|difficulty|number||○|難易度1〜5|
|13|archivedAt|datetime|||論理削除日時|

## 3. 移行・整合性
- seed version 3で100問を収録。
- `examScopeId` のない旧問題は `lpic101` へ補完する。
- 問題ID重複、選択肢範囲外の正解、無効な難易度を拒否する。
- アーカイブ済み問題は通常出題から除外し、履歴・メモ・提案との参照は保持する。

