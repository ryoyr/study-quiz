# F14 類似問題生成 詳細設計書

- 文書ID: DD-F14
- 上位文書: BD-F14
- 対応状況: **対応済（コピー＆レビュー方式）**
- 対象画面: 類似問題生成

## 1. コンポーネント責務
|コンポーネント|責務|
|---|---|
|`SimilarQuestionGeneratorPage`|元問題選択、プロンプト表示・コピー、JSON入力、下書き編集、確認、登録イベント|
|`buildSimilarQuestionPrompt`|元問題文脈とJSON出力契約を持つプロンプト生成|
|`parseSimilarQuestionDraft`|コードフェンス除去、JSON解析、正規化、一意ID採番、初回検証|
|`validateSimilarQuestion`|登録直前の単項目・相関・重複検証|
|`App.commitQuestions`|既存問題を含む配列の永続化と画面状態更新|

## 2. 状態
|状態|内容|
|---|---|
|`baseQuestionId`|選択中の元問題ID|
|`responseJson`|利用者が貼り付けたAI回答|
|`draft`|検証後の編集可能な問題案|
|`reviewConfirmed`|利用者の最終確認状態。下書き変更時はfalseへ戻す|
|`message` / `error`|成功・エラー通知|

## 3. イベント
|ID|契機|処理|正常時|異常時|
|---|---|---|---|---|
|F14-E01|元問題変更|下書き・確認・通知を初期化|新プロンプト表示|-|
|F14-E02|コピー|Clipboard APIへプロンプトを書込|成功通知|手動コピー案内|
|F14-E03|JSON読込|解析、正規化、採番、検証|下書き表示|下書きを破棄しエラー表示|
|F14-E04|下書き編集|画面状態更新、確認解除|編集継続|-|
|F14-E05|登録|再検証、確認判定、既存保存処理呼出|登録ID通知、下書き初期化|入力維持、エラー表示|

## 4. JSON入力契約
```json
{
  "category": "string",
  "subcategory": "string (optional)",
  "text": "string",
  "choices": ["2 to 8 strings"],
  "answerNumber": 1,
  "explanation": "string",
  "source": "string (optional)",
  "tags": ["string"],
  "weight": 1,
  "difficulty": 1
}
```

- `answerNumber` は1始まり。内部保存前に0始まりの `answerIndex` へ変換する。
- 文字列はtrimし、選択肢とタグの重複を検証する。
- 元問題IDは入力させず、既存ID集合から採番する。

## 5. 更新順序
1. 登録直前に下書きを再検証する。
2. 元問題を含む既存配列へ検証済み問題を追加する。
3. `commitQuestions` が `saveQuestions` を実行する。
4. 保存成功時のみReact状態を更新し、下書きを消去する。
5. 保存失敗時は下書きと既存データを維持する。

## 6. テスト観点
- プロンプトに元問題ID、正解、1始まり契約が含まれる。
- 通常JSONとJSONコードフェンスを処理できる。
- 既存SIM番号を飛ばして一意採番する。
- 同一問題文、重複選択肢、重複ID、範囲外正解を拒否する。
- 画面導線が存在し、外部AI自動送信コードを含まない。

