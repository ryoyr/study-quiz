# 問題・解説品質向上機能 設計 — 4.6.0

## 1. 目的

問題・解説をJSONで外部レビューへ渡し、ファクトチェックと同じ「自動送信しないコピー／取込方式」で修正提案・補足提案を生成する。提案の生成、レビュー、適用を分離し、適用前後を監査できるようにする。適用済み内容は実行環境だけでなく、新規環境の初期問題へ取り込める更新パックとして出力する。

## 2. 画面と責務

|画面|責務|
|---|---|
|問題・解説の品質向上|対象選択、入力JSON出力、品質確認プロンプト、提案JSON取込、登録前プレビュー|
|問題・解説品質提案レビュー|変更前後比較、競合検知、適用・却下、適用済み一覧、初期データ更新JSON出力|

提案登録時点では問題データを変更しない。`pending`状態の提案だけを明示確認後に適用できる。

## 3. JSON契約

### 入力

```json
{
  "format": "study-quiz-question-quality-input",
  "version": 1,
  "exportedAt": "ISO-8601",
  "questions": [
    {
      "id": "Q-1",
      "question": "問題文",
      "questionType": "single",
      "choices": ["A", "B"],
      "answer": { "kind": "single", "correctChoiceNumber": 1 },
      "explanation": "解説"
    }
  ]
}
```

### AI等からの提案出力

```json
{
  "format": "study-quiz-question-quality-proposals",
  "version": 1,
  "proposals": [
    {
      "questionId": "Q-1",
      "kind": "correction",
      "summary": "提案概要",
      "reason": "判断理由",
      "reference": "一次情報",
      "proposed": {
        "text": "修正後問題文",
        "explanation": "修正・補足後解説"
      }
    }
  ]
}
```

`kind`は誤りや不整合を直す`correction`、正しい内容へ根拠や注意点を加える`supplement`の2種。`proposed`には変更項目だけを含める。

## 4. 提案データ

`QuestionQualityProposal`は次を保持する。

- 提案ID、問題ID、種別、要約、理由、参考情報
- `beforeQuestion`: 提案作成時の完全な問題
- `proposedQuestion`: 提案適用後の完全な問題
- 状態: `pending | applied | rejected`
- 作成・更新・レビュー・適用日時

物理キーは`study-quiz-question-quality-proposals-v1`。完全バックアップ対象とする。

## 5. 検証

1. JSONサイズ5MB、提案10,000件を上限とする。
2. 対象問題IDが現在の問題に存在すること。
3. 同じJSON内で問題IDが重複しないこと。
4. `proposed`を現在問題へマージ後、共通問題検証を実行すること。
5. 問題ID、試験枠、カテゴリ、アーカイブ状態は提案で変更できないこと。
6. 実質的な変更がない提案を拒否すること。

## 6. 適用トランザクション

適用直前に現在問題と`beforeQuestion`を完全比較する。不一致なら提案作成後の別編集として適用を停止する。

一致時は次を同一localStorageトランザクションで更新する。

- 問題データ
- 問題シード版
- 品質提案（`applied`、レビュー日時、適用日時）

これにより問題だけ更新され提案状態が残らない中間状態を防ぐ。

## 7. 初期データ反映

適用済み提案から次の更新パックを出力する。

```json
{
  "format": "study-quiz-question-seed-updates",
  "version": 1,
  "appVersion": "4.6.0",
  "exportedAt": "ISO-8601",
  "updates": [
    {
      "questionId": "Q-1",
      "proposalId": "UUID",
      "appliedAt": "ISO-8601",
      "beforeQuestion": {},
      "question": {}
    }
  ]
}
```

リポジトリで次を実行する。

```bash
node tools/apply_question_seed_updates.mjs <seed-update-pack.json>
```

ツールは初期問題ID、問題形式、重複を検証し、`src/data/questionQualityOverrides.ts`を一時ファイル経由で更新する。新規環境では`questions.ts`が基本問題へ同IDの上書きを適用する。

ブラウザーからソースコードを直接変更せず、レビュー済み更新パックを成果物へ明示的に取り込むことで、実行環境と将来の初期投入データを分離する。

## 8. 版と互換性

- Application: 4.6.0
- localStorage schema: 9
- IndexedDB: 2
- Full backup: 10（2～10読込み）
- Service Worker cache: v22

新しい品質提案キー追加に伴いschemaとbackup versionを更新する。旧バックアップ2～8は従来どおり変換し、version 9以降はFNV-1a整合性を検証してからversion 10へ正規化する。
