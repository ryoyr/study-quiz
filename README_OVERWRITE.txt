Study Quiz 学習履歴版 上書き用リソース

追加機能:
- 回答履歴をlocalStorageへ保存
- 累計回答数、累計正答率、最終学習日時を表示
- 学習履歴の削除
- 保存処理をsrc/servicesへ分離
- 将来のIndexedDB移行を考慮したStudyHistory型

配置:
ZIP内の内容を C:\dev\study-quiz 直下へ上書きしてください。

確認:
cd C:\dev\study-quiz && npm run build

GitHub反映:
cd C:\dev\study-quiz && git add . && git commit -m "Add local study history" && git push
