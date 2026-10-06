# T12_EXAM_SCOPES テーブル定義書

## 1. 概要

- 物理媒体: IndexedDB `study-quiz`
- オブジェクトストア: `examScopes`
- 導入DBバージョン: 2
- 目的: 問題カテゴリより上位の試験枠を管理し、出題・管理・設定の共通絞り込みキーとする。

## 2. 項目定義

|No|項目ID|型|キー／索引|必須|説明|
|---:|---|---|---|---|---|
|1|id|string|PK|○|試験枠ID。初期値は `lpic101`|
|2|certification|string||○|認定名。`LPIC-1`|
|3|name|string||○|画面表示名。`LPIC-1 Exam 101`|
|4|examCode|string|UK|○|試験コード。`101-500`|
|5|version|string||○|目的バージョン。`5.0`|
|6|description|string||○|出題範囲概要|
|7|active|boolean||○|選択可能フラグ|
|8|sortOrder|number|IDX|○|表示順|
|9|createdAt|datetime||○|作成日時|
|10|updatedAt|datetime||○|更新日時|

## 3. 関係

- `QUESTIONS.examScopeId` → `EXAM_SCOPES.id`
- `SETTINGS.examScopeId` → `EXAM_SCOPES.id`
- 初期配布データはLPIC-1 Exam 101のみ。将来の試験追加時もカテゴリ文字列へ試験名を埋め込まず、このテーブルへ追加する。

## 4. 移行

- DB v1からv2への更新時にストアと初期レコードを作成する。
- 旧 `linuc101` 設定は互換読込し、次回保存時に `lpic101` へ正規化する。

