# DECISIONS — D1移行追補

## ADR-009 D1を共有問題・解説の正本とする（ADR-001/002を置換）

- 状態: 採用（5.0.0）
- 正本: Cloudflare D1。GitHub `public/content`は生成snapshotとmigration入力へ降格する。
- 端末: localStorageは学習実行データと`local-only`問題、IndexedDBは検証済みsnapshot cache。
- 同期: D1から端末への安全な一方向同期。端末からD1は差分確認・Access認証・明示確認後だけ。
- 禁止: local-only、学習履歴、メモ、APIキーのD1送信。
- 保護: Access JWT、許可メール、Origin/relay、fingerprint、監査、冪等性、TTL付き排他。

---

# DECISIONS — 総合改良プロジェクト

## ADR-001 問題マスター正本

- 状態: 採用
- 決定: 今回はGitHub `public/content`を唯一の正本として維持する。
- IndexedDB `questionMasterCache`とCache Storageは検証済み派生cacheであり、編集・承認の正本ではない。
- 理由: 現行にサーバーDB/API/移行運用がなく、今回DBを正本化すると安全な移行・認可・rollbackを満たせない。
- 禁止: GitHub JSONとDBのdual write、last-write-wins同期。

## ADR-002 将来DB候補

- 第一候補: PostgreSQL + Access認証済みAPI。
- 次点: Cloudflare D1 + Worker。
- 比較対象: Supabase PostgreSQL。
- IndexedDBは端末cache用途に限定。
- 本番切替条件: schema、revision、RBAC、migration dry-run、hash照合、rollback、監査、バックアップ、GitHub書込み停止。

## ADR-003 AI JSON修復境界

- JSON抽出はコードフェンス、前後説明、balanced object/arrayに限定。
- 自動修復はJSON文字列外の末尾カンマ除去だけ。
- 単一引用符変換、キー推測、型変換、欠落値生成、正答推測は行わない。
- parse後は機能固有validatorと共通Question validatorを必須とする。
- 失敗時の自動再生成は最大3回。検証エラーと前回応答を渡し、JSONだけを要求する。

## ADR-004 AI変更の保存

- AI出力を問題へ直接保存しない。
- 類似問題は下書きフォーム、品質修正はbefore/afterレビューを経由する。
- 問題適用は既存トランザクションを維持し、改訂履歴も同時保存する。
- 問題IDの変更は改訂履歴で禁止する。

## ADR-005 解説表示

- 解説はplain textとして保存する。
- 改行、空行、`-`／`*`／`•`／番号付き行をReact要素へ変換する。
- `dangerouslySetInnerHTML`、Markdown HTML、動的コード実行は使用しない。

## ADR-006 バックアップ互換

- 現行backup version 10を維持する。
- 問題改訂履歴は追加の任意JSON保存領域として同形式へ含める。
- 旧version 2～10の読込みを維持する。
- 既存個人データキーは変更しない。

## ADR-007 PWA cache

- Service Worker cache世代をv24へ進める。
- app shellは従来どおり、問題マスターはnetwork-first。
- 通信失敗時のみCache Storage、その後アプリ側でIndexedDBの検証済みsnapshotへfallbackする。
- `CLEAR_CONTENT_CACHE`で問題コンテンツだけを明示消去できる。

## ADR-008 セキュリティ

- Cloudflare Access、外部IdP、JWT検証、許可メール、Origin、Rate Limitを維持。
- GitHub App秘密情報をフロントへ渡さない。
- 実PR、本番DB書込み、秘密値の設定・出力は行わない。
