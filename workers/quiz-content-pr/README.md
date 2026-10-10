# Study Quiz Content Pull Request Worker

問題マスターの変更だけを、固定リポジトリの専用ブランチへ1コミットし、main向けPull Requestを作成するCloudflare Workerです。

## 安全性

- Cloudflare Access JWTをWorkers自身でも検証
- 許可メール、単一Origin、Rate Limiting、2MiB上限
- リポジトリ／ベースブランチ／`public/content`は環境設定で固定
- manifest versionと問題フィンガープリントの競合検出
- 内容由来の専用ブランチで重複送信を回収
- main更新・自動マージ処理なし
- GitHub App private keyはWorkers Secretだけで保持

## API

```text
POST /api/quiz-content/pull-requests
GET  /api/quiz-content/pull-requests/{number}
```

認証はCloudflare Access。詳細な作成・設定・障害対応は`../../docs/github-cloudflare-setup.md`を参照してください。
