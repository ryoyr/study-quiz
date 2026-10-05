# Study Quiz

資格試験向けのローカルファースト学習PWAです。試験日・復習期限・弱点・回答速度・利用可能時間を用いて学習セッションを構成します。

## 必要環境

- Node.js 20.19以上
- npm

## 開発コマンド

```bash
npm ci
npm run dev
npm run test
npm run typecheck
npm run build
npm run check
```

## v1.1.0で追加・修正した内容

- 欠落していたTypeScriptプロジェクト設定を追加
- 共通ErrorBoundaryとPWA更新通知・Service Worker登録をアプリルートへ接続
- PWAアイコンを正しいPNGとして再生成
- F14類似問題生成をコピー＆レビュー方式で正式実装
- 未統合の試作、旧画面、重複サービスを削除
- 類似問題サービスと構成・PWA回帰テストを追加

## データ保護方針

- 主要データは端末内に保存します。
- AI支援はプロンプトのコピー方式で、アプリから外部AIへ自動送信しません。
- 完全バックアップにAPIキーを含めません。

詳細は `doc/` とアップグレード成果物の `UPGRADE_REPORT.md` を参照してください。
