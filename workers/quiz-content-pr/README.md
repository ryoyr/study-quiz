# Study Quiz Content Pull Request Worker

`ryoyr/study-quiz`の問題マスター変更だけを固定専用ブランチへ1コミットし、main向けPull Requestを作成するCloudflare Workerです。GitHub Appは`study-quiz-content-manager`を使用します。

## URL

```text
Worker: https://study-quiz-content-pr.forxdevelop.workers.dev
GET  /api/quiz-content/access-session
POST /api/quiz-content/pull-requests
GET  /api/quiz-content/pull-requests/{number}
```

`https://ryoyr.github.io/study-quiz/`はAccess認証用popupをtop-levelで開き、認証後のpopupから同一オリジンでAPIを呼びます。これにより、GitHub PagesからWorkerへのクロスサイトCookieに依存しません。

## 安全性

- Cloudflare AccessとGoogle等の外部IdPを維持
- Cloudflare Access JWTをWorker自身でも署名、issuer、AUD、iat、nbf、expまで検証
- `ALLOWED_EMAILS`、固定Origin、同一オリジンrelay、Rate Limiting、2MiB上限
- popupは`https://ryoyr.github.io`との固定`postMessage`だけを許可し、厳格CSPを返す
- リポジトリ`ryoyr/study-quiz`、ベース`main`、`public/content`を環境設定で固定
- manifest versionと問題フィンガープリントの競合検出
- 内容由来の専用ブランチで重複送信を回収
- main更新・自動マージ処理なし
- GitHub App private key、installation ID、Access JWTはブラウザーへ返さない

Access Applicationは`study-quiz-content-pr.forxdevelop.workers.dev/api/quiz-content/*`を保護し、OPTIONSだけ既存のAccessバイパス設定を維持します。APIやセッションGETを無条件Bypassしてはいけません。

詳細な設定・検証・障害対応は`../../docs/github-cloudflare-setup.md`を参照してください。
