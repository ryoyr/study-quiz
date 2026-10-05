# T05_FSRS_STATE テーブル定義書

## 1. 概要
- 物理媒体: IndexedDBまたはlocalStorage互換領域
- 正本: 最終実装のRepository定義を優先し、移行時はversionを管理する
- 削除: 関連参照を確認し、孤児データを残さない

## 2. 項目定義
|No|項目ID|型|キー／索引|必須|説明|
|---:|---|---|---|---|---|
|1|questionId|string|PK|○|問題ID|
|2|state|number||○|FSRS state|
|3|due|datetime|IDX|○|期限|
|4|stability|number||○|安定度|
|5|difficulty|number||○|難易度|
|6|elapsedDays|number||○|経過日|
|7|scheduledDays|number||○|予定間隔|
|8|reps|number||○|反復数|
|9|lapses|number||○|忘却数|

## 3. 制約
- 主キー重複不可。
- 日時はISO 8601。
- enumは定義外値を拒否。
- JSON読込時はschema/versionと全項目を検証する。

## 4. 編集機能
- 参照機能: 関連する画面初期表示、集計、バックアップ。
- 更新機能: 対応UseCase経由のみ。UIから直接編集しない。
- バックアップ: APIキー等の秘密情報は除外する。
