# Study Quiz 5.0.0 基本設計

## 1. 全体構成

```text
GitHub Pages / 任意の静的ホスティング
  React PWA
    ├─ localStorage: 学習問題、local-only、履歴、FSRS、設定、メモ
    ├─ IndexedDB: 初期設定互換、検証済みD1 snapshot
    ├─ Cache Storage: app shell / 同梱snapshot
    └─ D1 API client
          │
          ▼
Cloudflare Worker: workers/quiz-content-db
    ├─ GET  /api/content/health
    ├─ GET  /api/content/snapshot
    ├─ GET  /api/content/access-session  [Access]
    └─ POST /api/content/changes         [Access]
          │ binding=DB
          ▼
Cloudflare D1: study-quiz-db
```

## 2. 正本

- 共有問題・解説: D1。
- ローカル専用問題と個人データ: 端末。
- `public/content`: D1 seed生成元兼offline snapshot。正本ではない。
- IndexedDB `questionMasterCache`: 検証済み派生cache。
- 旧GitHub PR Worker: 廃止。ビルド・テスト・デプロイ対象外。

## 3. 読取り経路

```text
App.initialize
  → fetchQuestionMasterWithSource
      → D1 GET /api/content/snapshot
      → 失敗: public/content snapshot
      → 失敗: IndexedDB verified snapshot
      → 失敗: 既存端末問題 / bundled seed
  → planQuestionMasterMerge（三者比較）
  → safe actionsだけlocalStorageへ反映
```

`local-only`問題はD1側に同じIDが存在しても自動更新せず、D1から消えても自動アーカイブしない。

## 4. 書込み経路

```text
QuestionMasterPage
  → buildQuestionMasterChanges
      sharedだけを抽出
      distributionをpayloadから除去
  → createApplyD1ChangesCommand
      base content/dataset versions
      question fingerprint
      message
      SHA-256 idempotency key
  → ConfirmDialog
  → Cloudflare Access popup
  → same-origin relay
  → POST /api/content/changes
  → Worker validation
  → D1 lock取得
  → D1 batch
      questions
      question_revisions
      dataset version
      content version
      idempotency response
  → lock解放
```

## 5. 認証・認可

- 読取りAPIは公開し、許可OriginへCORSを返す。
- 書込みとpopup画面はCloudflare Access対象とする。
- WorkerでAccess JWTを再検証する。
- `ALLOWED_EMAILS`に含まれる利用者だけ書込み可能。
- ブラウザーへAccess Service Token、秘密鍵、D1 credentialを置かない。
- `ALLOW_LOCAL_WRITE`は既定`false`。本番で有効化しない。

## 6. 競合・冪等性・監査

- content version不一致: 409。
- dataset version不一致: 409。
- question fingerprint不一致: 409。
- write lock競合: 409。
- 同じidempotency key: 保存済み応答を返し、再更新しない。
- 監査ログ: operation、before/after、subject、email、reason、idempotency key、日時。

## 7. PWA・オフライン

- Service Worker v25。
- navigationはnetwork-first、静的資材はcache-first。
- 同梱`public/content`はnetwork-firstで更新し、失敗時cacheへfallback。
- アプリはさらにIndexedDB snapshotへfallbackする。
- D1停止中も既存端末問題、履歴、local-only問題で学習を継続できる。

## 8. ビルド・デプロイ境界

- `tsconfig.app.json`: `src`。
- `tsconfig.node.json`: Vite設定と全テスト。
- D1 Worker: `npm run worker:typecheck`で独立strict型検査。
- Pages workflowはD1 Workerを型検査するが、本番Worker deployやremote migrationは実行しない。
