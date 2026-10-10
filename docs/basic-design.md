# Study Quiz 4.5.1 基本設計

## 1. システム構成

```text
Browser
├─ React UI
│  ├─ App.tsx
│  ├─ pages
│  └─ components
├─ Domain / Services
│  ├─ questionAnswerModel（回答方式境界）
│  ├─ questionValidation（問題整合性境界）
│  ├─ selection / session / analysis
│  ├─ storage / transaction / backup
│  └─ AI prompt adapters
├─ localStorage（学習データ正本）
├─ IndexedDB（初回設定・試験枠の互換保存）
└─ Service Worker / Cache Storage
```

ビルドはVite、言語はTypeScript、UIはReact 19、復習はts-fsrsを利用する。

## 2. レイヤー責務

|レイヤー|責務|配置|
|---|---|---|
|UI|入力、表示、確認、画面遷移|`App.tsx`, `pages`, `components`|
|アプリケーション|ユースケース調停|`application`|
|ドメイン／サービス|回答、検証、出題、分析、保存規則|`services`|
|インフラ|IndexedDB、リポジトリ|`infrastructure`|
|型・静的データ|永続化型、設定型、初期問題|`types`, `data`|
|品質保証|単体、構成、E2E|`tests`, `scripts`|

## 3. 永続化型と内部回答モデル

永続化互換の`Question`は、旧データを読むため`answerIndex`を必須のまま維持し、`answerIndices`、`acceptedAnswers`を任意保持する。

各機能はこれらを直接解釈せず、`answerDefinitionOf(question)`で次の内部モデルへ変換する。

```ts
type QuestionAnswerDefinition =
  | { kind: "single"; correctIndex: number }
  | { kind: "multiple"; correctIndices: number[]; scoring: "exact" }
  | {
      kind: "text";
      acceptedAnswers: string[];
      matching: "normalized-exact";
      normalization: TextAnswerNormalization;
    };
```

この境界により、採点、正答表示、履歴変換、AIコンテキスト、ファクトチェックを同じ意味モデルで扱う。

## 4. 回答フロー

```text
Question（互換形式）
  ↓ answerDefinitionOf
QuestionAnswerDefinition
  ├─ 採点
  ├─ 正答表示
  ├─ AI／ファクトチェック用形式
  └─ 類似問題契約

利用者回答
  ├─ number
  ├─ number[]
  └─ string
      ↓ responseToHistoryFields
StudyHistory（旧selectedIndex互換を維持）
```

新規履歴は`answerType`も保存する。旧履歴で省略されている場合も読込み可能とする。

## 5. 問題検証

`questionValidation.ts`を保存境界の唯一の共通検証とする。

```text
画面編集 ─┐
CSV取込 ──┼─> questionValidationErrors ─> Question
類似問題 ─┤
通常保存 ─┤
完全復元 ─┘
```

方式固有の検証に加え、文字数、タグ数、選択肢重複、正解範囲を確認する。

## 6. AI連携境界

- `promptBuilder`: 3方式の問題コンテキストを生成。
- `AiQuestionPanel`: 方式別の利用者回答を追加。
- `batchFactCheckService`: 判別可能な外部用回答定義をJSON化。
- `similarQuestionService`: 方式別JSON契約を生成・検証。

Gemini APIへ自動送信する機能と、他のAIへ手動コピーする機能を区別する。

## 7. 保存・復元

### 通常保存

1. 入力正規化。
2. 共通検証とID重複確認。
3. ジャーナル保存。
4. 対象キー更新。
5. 読戻し一致確認。
6. ジャーナル削除。
7. 失敗時ロールバック。

### 完全復元

1. サイズ・形式・版・チェックサム検証。
2. 旧キー・旧設定の正規化。
3. 領域・問題・参照の検証。
4. 差分表示。
5. 現在値の安全バックアップ。
6. 明示確認後のトランザクション復元。

### 回答時点スナップショット

- 新規回答では履歴へ問題文、回答方式、回答表示、正答表示を任意保存する。
- 学習履歴はスナップショットを現在の問題より優先する。
- 旧履歴はスナップショットなしで引き続き読込み、現在の問題データから表示する。
- スナップショットは回答履歴配列内の任意フィールドであり、保存キー・storage schema・backup versionは変更しない。

## 8. PWA

- manifestは相対URLと3アイコン、3ショートカットを持つ。
- Service Workerはnavigationをnetwork-first、静的資材をcache-firstとする。
- 4.5.1のキャッシュ世代はv21。
- PNGは`tools/generate_pwa_icons.py`で再生成可能。

## 9. 互換性方針

4.5.1では保存キー、schema 8、IndexedDB version 2、backup version 9を変更しない。回答時点スナップショットは任意フィールドとして追加し、旧履歴・旧バックアップをそのまま読めるようにする。
