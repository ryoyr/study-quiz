# Study Quiz 4.6.0 詳細設計 — 回答方式・履歴スナップショット

## 1. 回答モデルAPI

```ts
questionTypeOf(question): QuestionType
answerDefinitionOf(question): QuestionAnswerDefinition
isQuestionResponseCorrect(question, response): boolean
formatCorrectAnswer(question): string
formatQuestionResponse(question, response): string
responseToHistoryFields(response): LegacyHistoryAnswerFields
responseFromHistory(history): QuestionResponse | null
answerDefinitionForExternalUse(question): Record<string, unknown>
```

### 正規化

入力回答は次の固定ポリシーを適用する。

```text
Unicode NFKC
→ 前後空白除去
→ 連続空白を1空白へ
→ ロケール対応小文字化
→ 許容回答との完全一致
```

### 複数選択

正解・回答とも重複除去後に昇順化し、件数と各要素が完全一致した場合だけ正解とする。

## 2. 履歴互換

|回答|互換フィールド|
|---|---|
|択一|`selectedIndex = index`|
|複数|`selectedIndex = -1`, `selectedIndices = sorted unique indices`|
|入力|`selectedIndex = -1`, `textAnswer = raw text`|

新規履歴には`answerType`を追加する。旧履歴は同フィールドなしでも有効とする。

### 回答時点スナップショット

新規履歴には次の任意フィールドを保存する。

```ts
interface StudyHistoryQuestionSnapshot {
  questionText: string;
  answerType: "single" | "multiple" | "text";
  responseText: string;
  correctAnswerText: string;
}
```

- `questionText`: 回答時点の問題文。
- `responseText`: 回答時点の選択肢文言または入力文字列を含む表示文字列。
- `correctAnswerText`: 回答時点の正答表示。
- 各文字列は20,000文字以内とし、問題文と正答は空白だけを許可しない。
- 履歴表示はスナップショットを優先し、旧履歴だけ現行問題へフォールバックする。
- 問題の編集・アーカイブ・削除時に既存スナップショットは変更しない。

## 3. 問題検証

### 共通上限

|項目|上限|
|---|---:|
|ID・試験枠ID|200文字|
|カテゴリ・サブカテゴリ・タグ|500文字|
|問題文・選択肢・解説・出典・許容回答|各20,000文字|
|選択肢|8件|
|タグ|30件|
|許容回答|100件|

### 方式別

- single: 選択肢2～8件、重複なし、`answerIndex`範囲内。
- multiple: singleの選択肢条件、`answerIndices` 1件以上、整数、範囲内、重複なし。
- text: `choices=[]`を許容、`acceptedAnswers` 1～100件。

## 4. 類似問題JSON契約

### 択一

```json
{
  "questionType": "single",
  "category": "Linux",
  "text": "...",
  "choices": ["A", "B"],
  "answerNumber": 1,
  "explanation": "...",
  "source": "...",
  "tags": [],
  "weight": 1,
  "difficulty": 1
}
```

### 複数選択

```json
{
  "questionType": "multiple",
  "category": "Linux",
  "text": "...",
  "choices": ["A", "B", "C"],
  "answerNumbers": [1, 3],
  "explanation": "...",
  "source": "...",
  "tags": [],
  "weight": 1,
  "difficulty": 1
}
```

### 入力

```json
{
  "questionType": "text",
  "category": "Linux",
  "text": "...",
  "acceptedAnswers": ["LVM", "lvm"],
  "explanation": "...",
  "source": "...",
  "tags": [],
  "weight": 1,
  "difficulty": 1
}
```

`questionType`省略時は元問題の方式を使用する。生成案は元問題と同一文面、重複選択肢、重複ID、範囲外正解を拒否する。

## 5. 類似問題編集UI

- single: radio。
- multiple: checkbox。選択肢削除時に後続インデックスをデクリメント。
- text: 1行1回答のtextarea。
- 回答方式はAI JSONまたは元問題から決まり、下書き画面では読み取り表示する。

## 6. 外部AI用ペイロード

### 択一

```json
{ "kind": "single", "correctChoiceNumber": 1 }
```

### 複数選択

```json
{
  "kind": "multiple",
  "correctChoiceNumbers": [1, 3],
  "scoring": "exact"
}
```

### 入力

```json
{
  "kind": "text",
  "acceptedAnswers": ["LVM"],
  "matching": "normalized-exact",
  "normalization": {
    "unicode": "NFKC",
    "trim": true,
    "collapseWhitespace": true,
    "caseSensitive": false
  }
}
```

永続化用の0開始インデックスを、外部向けでは1開始の選択肢番号へ変換する。

## 7. CSV

- 共通必須: `id, category, text`
- `questionType`省略: single
- single: `choice1..8`, `answer`
- multiple: `choice1..8`, `answers`（`1|3`）
- text: `acceptedAnswers`（`LVM|lvm`）

CSV固有検証後に共通問題検証を実行する。

## 8. 完全バックアップ

- 品質提案保存領域追加のためbackup version 10を使用。
- `answerType`は任意フィールドとして許容。
- `questionSnapshot`は任意フィールドとして検証・保持。
- version 9～10はFNV-1aを検証してから正規化。
- version 2～8は現行形式へ変換後、新しい整合性情報を付ける。

## 9. 問題・解説品質向上

JSON契約、提案状態、適用トランザクション、初期データ反映は`docs/question-quality-design.md`を正本とする。

## 10. PWA資材

`generate_pwa_icons.py`は180、192、512、maskable 512のRGBA PNGを生成する。通常アイコンは角丸透過、maskableは全面背景と中央安全領域を持つ。

## 4.7.0 問題マスター同期・PR詳細

### 同期判定

- 前回配布フィンガープリント = 端末 = 最新配布: 維持
- 前回配布 = 端末、最新配布だけ変更: 安全更新
- 前回配布 = 最新配布、端末だけ変更: 端末編集を維持しPR差分
- 端末と最新配布の両方が変更: 競合として保留
- 配布元削除かつ端末未変更: `archivedAt`を付与
- 配布元削除かつ端末変更: 競合として端末を維持

### Accessセッションrelay

1. 利用者の明示確定イベント内で`/api/quiz-content/access-session`をpopupのtop-level navigationとして開く。
2. Accessの302を通常ナビゲーションとしてGoogle等の外部IdPへ進める。
3. Workerは`Cf-Access-Jwt-Assertion`のRS256署名、issuer、AUD、iat、nbf、exp、メール許可を検証する。
4. 認証済みHTMLは厳格CSP、no-store、no-referrerを返し、`https://ryoyr.github.io`だけへreadyを`postMessage`する。
5. popupは固定形式のcreate/statusだけを受け、同一Workerオリジンへ`credentials: same-origin`で要求する。
6. Workerは`Sec-Fetch-Site: same-origin`と非CORS許可ヘッダーを確認し、応答JSONだけを固定Originへ返す。Access JWTは返さない。

### PRトランザクション

1. Access JWT／利用者／Originまたは同一オリジンrelay／Rate Limit／入力を検証。
2. 冪等ブランチと既存PRを確認。
3. main refのcommit SHAとtree SHAを取得。
4. commit SHA固定でmanifest／datasetを読込・再検証。
5. base content version、dataset version、問題フィンガープリントを照合。
6. 変更済みdatasetとmanifestをblob化。
7. base treeから1つのtreeとcommitを作成。
8. `refs/heads/quiz-content/*`を作成。
9. main向けPRを作成。merge APIは呼ばない。
10. 途中失敗後の再送は同じbranchを使い、PRだけを回収する。

### キャッシュ

`public/content/**`はService Worker v23でnetwork-first。HTTP非2xx、タイムアウト、オフライン時のみ直近キャッシュへ戻す。JSON検証失敗時は端末データへ適用しない。
