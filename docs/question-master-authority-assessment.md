# 問題マスター正本・DB移行調査

## 1. 現状

|層|用途|正本か|
|---|---|---:|
|GitHub `public/content`|レビュー済み配布問題、manifest、dataset、PR履歴|はい|
|localStorage `study-quiz-questions-v1`|利用者端末の学習・個別編集|個人端末の作業データ|
|Cache Storage|PWA app shell・配布問題fallback|いいえ|
|IndexedDB v2|初期設定、予約日、試験枠|問題マスターではない|
|Cloudflare Worker|GitHub App経由のPR作成|正本を持たない|

端末編集は配布マスターと別目的であり、三者比較により保護される。GitHubとlocalStorageを同一の組織正本とは扱わない。

## 2. DB候補比較

### PostgreSQL + 専用API

- 長所: 主キー・外部キー・CHECK、ACID、revision table、全文検索、監査、migration、backup。
- 課題: API、Access主体マッピング、RBAC、接続pool、運用監視、費用、migrationが必要。
- 適性: 複数編集者、問題数増加、監査要件がある本命構成。

### Cloudflare D1 + Worker

- 長所: 現行Worker／Accessと同じ基盤、低運用負荷、SQLite transaction。
- 課題: PostgreSQLより制約・運用選択肢が限定、既存GitHubレビューを置換するUIが必要。
- 適性: 小規模、Cloudflare集約を優先する場合。

### Supabase PostgreSQL

- 長所: PostgreSQL、REST、RLS、管理UI。
- 課題: AccessとSupabase Authの責務整理、RLS誤設定、外部サービス依存。
- 適性: 迅速なDB API構築。ただし認証統合設計が必要。

### IndexedDB

- 長所: オフライン、ブラウザー標準、追加サービス不要。
- 課題: 端末単位、共有・監査・組織backup不可。
- 適性: cache／作業データのみ。組織正本には不適。

## 3. 今回の決定

- `QUESTION_MASTER_AUTHORITY = "github-content"`。
- GitHub `public/content`を唯一の正本として維持。
- IndexedDB v3の`questionMasterCache`は`derived-offline-cache`。
- remote取得成功後、検証済みsnapshotをcacheへ保存。
- remote／SW cacheが使えない場合、同じmanifest／dataset validatorを通してIndexedDB cacheを利用。
- cacheへ編集・承認・PR結果を書き戻さない。
- DBとGitHubへのdual writeは実装しない。

## 4. 将来DB正本化の必要条件

### schema例

```sql
question_master(id, current_revision_id, status, created_at, updated_at)
question_revision(id, question_id, revision_no, payload_json, content_hash,
                  reason, actor_subject, created_at)
question_publication(id, revision_set_hash, published_at, actor_subject)
```

必須制約:

- `question_master.id`は既存問題IDをそのまま主キーにする。
- revisionはappend-only。
- payloadはアプリQuestion schemaをAPI側でも検証。
- 公開版はrevision集合とcontent hashを固定。
- optimistic lockまたはbase revision必須。

### 移行手順

1. GitHub JSONをread-onlyで抽出。
2. staging DBへinsertし、件数、ID集合、Question schema、hashを照合。
3. 全不一致を解消するまで本番切替しない。
4. DB APIをread-only shadowとして運用し、GitHub応答と比較。
5. feature flagで読取りをDBへ切替。
6. DB書込みUIとrevision承認を有効化。
7. GitHubへの問題JSON書込みを停止し、必要ならDBから生成する配布snapshot／監査exportへ降格。
8. rollback期間後に正本宣言を更新。

### 禁止事項

- 同じ編集操作をDBとGitHubへ同時書込み。
- timestampだけのlast-write-wins。
- 問題ID再採番。
- 学習履歴、FSRS、お気に入り、メモのquestionIdを書換え。
- migration照合前のGitHub書込み停止。

## 5. 今回未実施

- 本番DB・テーブル作成。
- GitHubデータのinsert。
- DB API公開。
- Access policy変更。
- 正本切替。

理由: 本番接続情報、DB選定、運用主体、認可要件、rollback合意がなく、不可逆操作を禁止されているため。
