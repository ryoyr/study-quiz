# TASKS — 総合改良プロジェクト

|ID|優先|依存|タスク|完了条件|状態|関連ファイル|
|---|---:|---|---|---|---|---|
|INV-01|P0|-|最新ダンプ復元・構成調査|197/197、安全復元、欠落資材だけ補完|完了|`project_dump_full.txt`|
|PLAN-01|P0|INV-01|計画・優先順位・範囲決定|計画、依存、非対象、完了条件を記録|完了|`PROJECT_PLAN.md`|
|AI-01|P0|PLAN-01|JSON候補抽出|fence、前後説明、balanced JSON|完了|`aiJsonPipeline.ts`|
|AI-02|P0|AI-01|安全な自動修復|文字列外の末尾カンマだけを修復|完了|`aiJsonPipeline.ts`|
|AI-03|P0|AI-02|スキーマ・整合性検証|類似問題、品質提案、Question検証を通す|完了|`similarQuestionService.ts`, `questionQualityService.ts`|
|AI-04|P0|AI-03|規定回数再生成|最大3回、検証エラーを次promptへ反映|完了|`geminiService.ts`, `aiJsonPipeline.ts`|
|AI-05|P1|AI-04|類似問題UI統合|コピー方式維持、自動生成・検証・下書き|完了|`SimilarQuestionGeneratorPage.tsx`|
|REV-01|P0|PLAN-01|改訂履歴型・保存|ID維持、前後、変更項目、source、時刻|完了|`QuestionRevision.ts`, `questionRevisionService.ts`|
|REV-02|P0|REV-01|手動編集履歴|保存成功後に履歴追加|完了|`QuestionManagementPage.tsx`|
|REV-03|P0|REV-01|品質提案履歴|問題・提案・revisionを同一transaction|完了|`questionQualityProposalStorage.ts`|
|REV-04|P1|REV-01|master同期履歴|安全適用actionを履歴化|完了|`QuestionMasterPage.tsx`|
|FMT-01|P1|PLAN-01|安全な段落・箇条書き表示|HTML挿入なし、改行・空行・list維持|完了|`StructuredText.tsx`|
|EDIT-01|P1|FMT-01,REV-01|フォーム簡略化|保存前preview、既存値の部分編集、直近履歴|完了|`QuestionManagementPage.tsx`|
|DB-01|P0|INV-01|DB候補比較・正本決定|候補、採否、dual master禁止を記録|完了|`PROJECT_PLAN.md`, `DECISIONS.md`|
|DB-02|P1|DB-01|IndexedDB cache準備|v3、派生snapshot、検証済みfallback|完了|`database.ts`, `questionMasterService.ts`|
|PWA-01|P1|DB-02|cache整合性|SW v24、network-first、明示content消去|完了|`public/sw.js`|
|BKP-01|P0|REV-01|revision backup検証|registry、形式、参照ID検証|完了|`storageKeyRegistry.ts`, `fullBackupService.ts`|
|SEC-01|P0|全実装|認証・秘密・GitHub回帰|Worker型、静的秘密検査、PR mock|完了|`workers/**`, `tests/worker*.test.ts`|
|TEST-01|P0|全実装|追加・既存試験|AI、revision、表示、DB、PWA、回帰|完了|`tests/**`、214/214、E2E成功|
|DOC-01|P1|全実装|文書・進捗・報告|計画、決定、進捗、試験報告|完了|`PROJECT_PLAN.md`等|
|PKG-01|P0|TEST-01,DOC-01|ZIP・展開検証|秘密除外、SHA、展開、構成、可能な試験|完了|`SHA256SUMS_COMPLETE.txt`, Release Manifest|
|DB-F01|P2|DB-01|本番DB正本化|API・RBAC・migration・rollback後に単独正本化|将来|別リリース|
