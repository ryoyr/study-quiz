# TASKS — 5.0.0 D1整合修復

|ID|優先|タスク|状態|完了条件|
|---|---:|---|---|---|
|FIX-01|P0|D1・旧PRの全参照調査|完了|runtime/build/test/deploy/docを分類|
|FIX-02|P0|根本原因確定|完了|旧PR契約とD1契約の混在を特定|
|FIX-03|P0|旧PR実装整理|完了|Worker/API/型/テスト/専用文書を現行対象から除外|
|FIX-04|P0|D1 API型・応答検証強化|完了|dataset version・status範囲を検証|
|FIX-05|P0|D1セキュリティ回帰|完了|Access/JWT/email/CORS/relay/local-onlyを試験|
|FIX-06|P1|構成検証強化|完了|旧経路再混入、script、tsconfig、CI、migrationを検査|
|FIX-07|P1|設計・要件・追跡文書更新|完了|D1現行構成へ統一|
|FIX-08|P0|指定順ローカル検証|完了|各コマンド成功・結果記録|
|FIX-09|P0|ZIP・SHA・展開検証|完了|修正版ZIP提示|
|OPS-01|P0|本番migration/deploy|対象外|別途backup・承認後に実施|
