# 問題マスター正本評価 — D1移行後

## 結論

Study Quiz 5.0.0では、共有問題・解説の唯一の正本はCloudflare D1である。

```ts
QUESTION_MASTER_AUTHORITY = "cloudflare-d1"
```

## 各保存層の役割

|層|役割|正本|
|---|---|---:|
|Cloudflare D1|共有問題・解説、版、監査、冪等応答|共有データの正本|
|localStorage|学習用問題、local-only、履歴、設定、メモ|個人端末データの正本|
|IndexedDB|検証済みD1 snapshot cache|いいえ|
|Cache Storage|PWA shell・同梱snapshot cache|いいえ|
|`public/content`|seed入力・offline snapshot|いいえ|
|GitHub PR Worker|5.0.0で廃止|いいえ|

## 旧GitHub PR Workerを廃止する理由

1. アプリの現在の書込み先はD1 `/api/content/changes`であり、PR APIを呼ばない。
2. `QuestionMasterPage`はD1 commandとD1結果型だけを利用する。
3. GitHub用commandのtitle/body/commitMessageとD1用messageは契約が異なる。
4. 両方を同じTypeScriptプロジェクトへ残すと、二重正本・誤デプロイ・型契約混在を招く。
5. D1にはrevision監査、fingerprint競合、冪等性、明示確認があり、旧PR Workerの安全要件を置換している。

したがって、旧型をD1型へ無理に追加する互換対応は行わない。旧Worker、API client、テスト、専用文書、デプロイ設定を成果物から除外する。

## D1移行の安全性

- 問題IDは維持する。
- 既存100問の件数・ID・hashをseed生成時に照合する。
- local-onlyをクライアントとWorkerの両方で遮断する。
- 学習履歴・FSRS・メモはD1 schemaに存在せず送信しない。
- 更新はbase content version、dataset version、question fingerprintで競合検知する。
- `question_revisions`へbefore/afterを保存する。
- `idempotency_keys`で重複更新を防ぐ。
- `content_write_lock`とD1 batchで更新単位を保護する。

## 今回の整合修正におけるスキーマ影響

アプリ・テスト・設定・文書の旧PR参照を整理するだけであり、D1のテーブル・列・制約・seed内容を変更しない。よって`0003` migrationは不要である。
