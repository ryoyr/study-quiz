# TASKS — D1完全移行

|ID|優先|タスク|状態|完了条件|
|---|---:|---|---|---|
|D1-INV-01|P0|dump安全復元と現状調査|完了|211/211、D1未実装・dump欠落資材を識別|
|D1-PLAN-01|P0|正本・端末・offlineの役割決定|完了|D1正本、端末実行データ、snapshot/cache fallback|
|D1-SCHEMA-01|P0|D1 schema migration|完了|制約、index、revision、idempotency、lock|
|D1-SEED-01|P0|既存問題をD1 seed化|完了|同梱datasetと件数・hash一致|
|D1-API-01|P0|snapshot read API|完了|D1をQuestionMasterSnapshotとして返す|
|D1-API-02|P0|認証write API|完了|Access JWT、許可利用者、CORS/relay、入力検証|
|D1-API-03|P0|競合・冪等・監査・排他|完了|fingerprint競合停止、重複反映なし、revision記録|
|D1-LOCAL-01|P0|ローカル専用問題|完了|新規既定local-only、送信候補とWorkerの両方で除外|
|D1-SYNC-01|P0|D1→端末安全同期|完了|三者比較、端末編集保護、削除はarchive|
|D1-OFFLINE-01|P0|offline fallback|完了|同梱snapshot→IndexedDB→端末seed|
|D1-UI-01|P1|D1同期・公開画面|完了|取得元、差分、除外件数、確認、結果を表示|
|D1-DOC-01|P1|導入・運用・rollback文書|完了|コピペ可能なWrangler手順|
|D1-TEST-01|P0|単体・型・build・構成検証|完了|全ゲート成功または具体的制約を記録|
|D1-PKG-01|P0|ZIP・checksum・展開検証|完了|配布ZIP提示、展開後hash一致|
|D1-OPS-01|P0|本番D1 migration/deploy|利用者実施|Cloudflare認証環境でbackup後に適用|
