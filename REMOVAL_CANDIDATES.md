# 削除推奨ファイル一覧

## 1. 今回削除したファイル

以下は過去の差分ZIPや中間検証専用で、現行完全ソースへ混在させると適用対象・検証結果・チェックサムを誤認するため削除しました。必要な履歴は`CHANGELOG.md`、本資料、現行設計・検証報告へ統合しています。

|ファイル|判定|理由|
|---|---|---|
|`APPLY_ACCESSIBILITY_FIX.md`|削除|旧アクセシビリティ差分ZIP専用|
|`APPLY_GUIDE.md`|削除|旧上書き適用手順。現行READMEと競合|
|`APPLY_THEME_UPDATE.md`|削除|旧テーマ差分ZIP専用|
|`APPLY_UPDATE.md`|削除|旧4.4.0上書き手順|
|`PATCH_MANIFEST.md`|削除|旧アクセシビリティパッチ対象一覧|
|`PATCH_MANIFEST_THEME.md`|削除|旧テーマパッチ対象一覧|
|`SHA256SUMS.txt`|削除|6件の不一致を確認した旧部分パッチ用ハッシュ|
|`SHA256SUMS_THEME.txt`|削除|9件の不一致を確認した旧テーマパッチ用ハッシュ|
|`THEME_ACCESSIBILITY_REPORT.md`|削除|旧作業時点の報告。現行評価と重複|
|`UPGRADE_REPORT.md`|削除|4.3→4.4の中間報告。現行変更一覧へ統合|
|`VALIDATION_REPORT.md`|削除|初期参考版の失敗・制約を記録した履歴資料|
|`VALIDATION_REPORT_COMPLETE.md`|削除|旧完全版の失敗・制約を記録した履歴資料|
|`COMPLETE_RELEASE.md`|削除|旧4.4.0配布説明|
|`RESOURCE_UPDATE.md`|削除|旧PWA画像補完作業の報告|
|`ANALYSIS_AND_IMPROVEMENT_PLAN.md`|置換削除|最新169ファイルではなく旧160ファイルを基準としていた|
|`IMPROVEMENT_REPORT.md`|置換削除|旧120試験時点の報告。現行報告へ置換|

## 2. 維持したファイル

|ファイル／領域|判定|理由|
|---|---|---|
|`CHANGELOG.md`|維持|リリース履歴の正本|
|`README.md`|維持|導入・操作の入口|
|`docs/*.md`|維持・更新|現行要件・設計・追跡表|
|`SHA256SUMS_COMPLETE.txt`|維持・再生成|現行ZIP全体の整合性確認に利用|
|`tools/generate_pwa_icons.py`|維持|ダンプ対象外PNGを再生成可能にする|
|`src/application/setup/SaveInitialSetupUseCase.ts`|維持|初回設定から到達している|
|`src/services/*`|維持|mainから未到達のランタイムソース0件|

## 3. 今後の削除・統合候補

現時点では削除せず、条件を満たした場合に再評価します。

|候補|現状|削除・統合条件|
|---|---|---|
|`src/services/questionAnswerService.ts`|互換ファサード|全importを`questionAnswerModel.ts`へ移行し、外部参照が0になった時|
|旧互換フィールド`answerIndex` / `selectedIndex`|保存互換に必要|storage schemaとbackup versionを上げ、移行完了後|
|localStorage用の個別storage service群|現役|IndexedDB正本化と移行完了後|
|`src/application`の単一UseCase構成|将来拡張の足場|アプリケーション層を廃止する明確な設計判断がある場合のみ|
|ルートの分析・リリース資料|今回の納品要件|恒常リポジトリへ取り込む際に`docs/release/4.5.0`へ移動可能|

## 4. ソース未参照監査

TypeScript/TSXの静的importグラフを`src/main.tsx`から走査した結果、型宣言を除く未到達ランタイムソースは0件でした。このため、今回「未使用に見える」という理由だけでソースコードを削除していません。

動的import、テスト専用import、Service Worker、ビルドスクリプトはランタイムグラフとは別に確認しています。
