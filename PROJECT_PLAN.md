# PROJECT PLAN — Study Quiz 5.0.0 D1整合修復

## 目的

D1移行後に残存した旧GitHub PR Workerの型・サービス・テスト・文書を整理し、D1を共有正本とする単一の実行経路へ統一する。

## 調査対象

- 正本、読取り・書込みAPI、Access認証、local-only、同期方式
- `package.json`、lockfile、tsconfig、Wrangler、CI
- アプリAPI client、ページ、型、サービス
- D1 Worker、migration、seed
- 全テスト、構成検証、文書
- 旧PR Workerとの重複・import・build・deploy参照

## 決定

1. D1設計を正とする。
2. 旧PR Workerへ互換型・互換関数を戻さない。
3. 実行時依存がないことを確認後、旧Worker、API client、専用テスト・文書を成果物から除外する。
4. Access JWT、許可メール、CORS/relay、冪等性、競合、監査、local-only禁止を維持・追加試験する。
5. 保存schemaに変更がないためmigrationを追加しない。
6. esbuild install script警告とTypeScriptエラーを切り分け、セキュリティ設定を変更しない。

## 検証順

```text
構成検証
→ D1 seed生成
→ ローカルD1 migration
→ 単体試験
→ アプリTypeScript型検査
→ Worker型検査
→ 本番build
→ Chromium E2E
→ 最終構成検証
→ ZIP展開後hash検証
```

## 非対象

- remote D1 migration
- Worker本番deploy
- 本番データ変更・削除
- Access policy変更・認証無効化
- テスト削除による見かけ上の成功
