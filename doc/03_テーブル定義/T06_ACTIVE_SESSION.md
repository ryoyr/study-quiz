# T06_ACTIVE_SESSION テーブル定義書

## 1. 概要
- 物理媒体: IndexedDBまたはlocalStorage互換領域
- 正本: 最終実装のRepository定義を優先し、移行時はversionを管理する
- 削除: 関連参照を確認し、孤児データを残さない

## 2. 項目定義
|No|項目ID|型|キー／索引|必須|説明|
|---:|---|---|---|---|---|
|1|version|number||○|形式版|
|2|questionIds|string[]||○|出題順|
|3|currentIndex|number||○|現在位置|
|4|correctCount|number||○|正答数|
|5|startedAt|datetime||○|開始日時|
|6|updatedAt|datetime||○|更新日時|

## 3. 制約
- 主キー重複不可。
- 日時はISO 8601。
- enumは定義外値を拒否。
- JSON読込時はschema/versionと全項目を検証する。

## 4. 編集機能
- 参照機能: 関連する画面初期表示、集計、バックアップ。
- 更新機能: 対応UseCase経由のみ。UIから直接編集しない。
- バックアップ: APIキー等の秘密情報は除外する。

