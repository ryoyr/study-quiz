# D1完全移行計画 — Study Quiz 5.0.0

基準入力: `project_dump_full.txt`（211テキストファイル）  
対象D1: binding=`DB` / database_name=`study-quiz-db` / database_id=`e342a769-d2fc-493f-88a7-9aac70f7914c`

## 1. 現状評価

- 現行4.7.0は、GitHub `public/content`を共有問題マスター、localStorageを学習用問題、IndexedDBを検証済みキャッシュとしている。
- D1スキーマ、D1 API、D1 migration、D1へのseed投入処理は未実装だった。
- dumpには文書・検証スクリプトが参照する旧GitHub連携Worker、PWA PNG、補助ツールが含まれていなかった。
- したがって、文書上の完了状態をそのまま配布可能状態とは判定しない。

## 2. 採用アーキテクチャ

```text
Cloudflare D1（共有問題・解説の正本）
        │ 公開read API / Access認証write API
        ▼
Cloudflare Worker（検証・CORS・JWT・排他・監査・冪等性）
        │
        ▼
React PWA
  ├─ localStorage: 学習で実際に使う問題、ローカル専用問題、履歴、設定
  ├─ IndexedDB: 最後に検証できたD1 snapshot
  ├─ Cache Storage: app shell + 同梱snapshot
  └─ public/content: 初回・完全オフライン用の生成snapshot（正本ではない）
```

## 3. データ所有権

|データ|正本|D1送信|
|---|---|---|
|共有問題・解説|D1|明示確認後のみ|
|ローカル専用問題|端末localStorage|常に除外|
|学習履歴・FSRS・メモ・お気に入り・設定|端末|送信しない|
|同梱JSON|D1の配布snapshot|書込み不可、offline fallback|
|IndexedDB snapshot|D1の派生cache|書込み不可、offline fallback|

`Question.distribution`を追加し、`local-only`をWorker送信前・Worker受信時の二重境界で拒否する。新規手動登録、CSV取込、AI類似問題は既定で`local-only`とする。D1から取得・適用した問題は`shared`として扱う。

## 4. 読取り順序

1. D1 Worker `GET /api/content/snapshot`
2. 同梱 `public/content/manifest.json` + dataset JSON
3. IndexedDBの検証済みsnapshot
4. 既存端末問題／TypeScript seed

同期は三者比較を維持し、端末で編集した内容を自動上書きしない。D1で消えた共有問題は、履歴参照を壊さないよう端末でアーカイブする。

## 5. 書込み順序

1. D1最新版を取得する。
2. `shared`だけで差分を作る。`local-only`は候補数として表示するがpayloadへ入れない。
3. 変更前後・対象件数を画面表示し、確認ダイアログを要求する。
4. Cloudflare Access popup内のsame-origin relayからWorkerへ送る。
5. WorkerでJWT、許可メール、Origin/relay、schema、local-only混入、base fingerprintを検証する。
6. D1排他行をTTL付きで取得し、D1 batchで問題、revision、dataset version、content version、idempotency responseを更新する。
7. 成功後だけ端末同期基準を更新する。

## 6. D1スキーマ

- `content_meta`: content versionと更新日時
- `datasets`: データセット版・表示名
- `questions`: 問題・解説・回答定義・hash・revision
- `question_revisions`: before/after、操作、実行者、冪等キーの監査
- `idempotency_keys`: 同じ送信の重複反映防止
- `content_write_lock`: 複数Workerインスタンス間の短期排他

## 7. 移行手順

```bash
npm ci --no-audit --no-fund
npm run d1:seed:build
npm run d1:migrate:local
npm run worker:dev
npm run check
npm run d1:migrate:remote
npm run worker:deploy
```

`d1:migrate:remote`と`worker:deploy`はCloudflare認証済み端末で実行する。本成果物は本番D1への不可逆操作を実行していない。

## 8. ロールバック

- UIのD1書込みを停止し、読取りは同梱snapshot／IndexedDBへfallbackする。
- D1 migration適用前に `wrangler d1 export study-quiz-db --remote` でSQL backupを取得する。
- 問題更新は`question_revisions`のbefore JSONから復元できる。
- DB障害時もローカル問題・履歴・設定を削除しない。

## 9. 完了条件

- 指定D1 bindingを含むWrangler設定。
- schema migrationと既存100問seed migration。
- D1 snapshot API、Access認証write API、監査、冪等性、排他。
- 起動時のD1→端末安全同期、static/IndexedDB fallback。
- ローカル専用問題がread/write payloadへ漏れない試験。
- 単体、型、build、構成、ZIP展開後hash検証。
