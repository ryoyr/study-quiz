# TEST REPORT — D1重点検証

## 保持した契約

- 正本: `cloudflare-d1`
- Read: `/api/content/health`, `/api/content/snapshot`
- Write: Access popup → `/api/content/changes`
- Auth: RS256 / issuer / AUD / iat / nbf / exp / allowed emails
- Safety: Origin, CSP, same-origin relay, 2MiB, SHA-256 idempotency
- Conflict: content version, dataset version, question fingerprint, write lock
- Audit: before/after, subject, email, message, idempotency key
- Privacy: local-only、履歴、FSRS、メモ、APIキーを送信しない

## 結果

- D1/API/Access/HTTP追加試験を含む全単体: 210/210 PASS。
- migration: 初回・再適用PASS、100問、外部キー違反0。
- Worker strict TypeScript: PASS。
- 構成検証: 旧PR runtime/build/deploy参照0。
- D1 schema変更: なし。migration追加なし。

詳細コマンド・環境制約は`REPAIR_REPORT_5.0.0.md`を参照。
