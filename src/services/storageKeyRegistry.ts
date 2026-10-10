export type StorageValueFormat = "json" | "number" | "internal";

export interface StorageKeyDefinition {
  key: string;
  label: string;
  format: StorageValueFormat;
  backup: boolean;
  legacy: boolean;
}

/**
 * localStorageで利用する物理キーと論理名の唯一の定義元。
 *
 * 新しい保存領域を追加するときは、個別サービスへ文字列を直書きせず、
 * 必ずこのレジストリへ登録する。
 */
export const STORAGE_KEY_REGISTRY = {
  schemaVersion: {
    key: "study-quiz-schema-version",
    label: "データ形式",
    format: "number",
    backup: true,
    legacy: false,
  },
  setup: {
    key: "study-quiz-setup-v1",
    label: "設定",
    format: "json",
    backup: true,
    legacy: false,
  },
  questions: {
    key: "study-quiz-questions-v1",
    label: "問題",
    format: "json",
    backup: true,
    legacy: false,
  },
  answerHistory: {
    key: "study-quiz-answer-history-v1",
    label: "回答履歴",
    format: "json",
    backup: true,
    legacy: false,
  },
  questionStates: {
    key: "study-quiz-question-states-v1",
    label: "問題状態・FSRS",
    format: "json",
    backup: true,
    legacy: false,
  },
  mistakeNotes: {
    key: "study-quiz-mistake-notes-v1",
    label: "間違いノート",
    format: "json",
    backup: true,
    legacy: false,
  },
  questionAnnotations: {
    key: "study-quiz-question-annotations-v1",
    label: "お気に入り・メモ",
    format: "json",
    backup: true,
    legacy: false,
  },
  correctionSuggestions: {
    key: "study-quiz-correction-suggestions-v1",
    label: "問題修正提案",
    format: "json",
    backup: true,
    legacy: false,
  },
  questionQualityProposals: {
    key: "study-quiz-question-quality-proposals-v1",
    label: "問題・解説品質提案",
    format: "json",
    backup: true,
    legacy: false,
  },
  aiPromptTemplates: {
    key: "study-quiz-ai-prompt-templates-v1",
    label: "AI質問テンプレート",
    format: "json",
    backup: true,
    legacy: false,
  },
  dailyTimeBudget: {
    key: "study-quiz-daily-time-budget-v1",
    label: "1日の学習時間上限",
    format: "number",
    backup: true,
    legacy: false,
  },
  activeSession: {
    key: "study-quiz-active-session-v1",
    label: "中断中の学習",
    format: "json",
    backup: true,
    legacy: false,
  },
  transactionJournal: {
    key: "study-quiz-storage-transaction-v1",
    label: "保存トランザクションジャーナル",
    format: "internal",
    backup: false,
    legacy: false,
  },
  questionSeedVersion: {
    key: "study-quiz-question-seed-version",
    label: "初期問題データ版",
    format: "number",
    backup: false,
    legacy: false,
  },
  uiGuideSeen: {
    key: "study-quiz-ui-guide-seen-v2",
    label: "初回操作ガイド表示済み",
    format: "internal",
    backup: false,
    legacy: false,
  },
  legacyHistory: {
    key: "study-quiz-history-v1",
    label: "旧回答履歴",
    format: "json",
    backup: false,
    legacy: true,
  },
  geminiApiKey: {
    key: "study-quiz-gemini-api-key-v1",
    label: "Gemini APIキー",
    format: "internal",
    backup: false,
    legacy: false,
  },
  geminiModel: {
    key: "study-quiz-gemini-model-v1",
    label: "Geminiモデル設定",
    format: "internal",
    backup: false,
    legacy: false,
  },
} as const satisfies Record<string, StorageKeyDefinition>;

export const STORAGE_KEYS = {
  schemaVersion: STORAGE_KEY_REGISTRY.schemaVersion.key,
  setup: STORAGE_KEY_REGISTRY.setup.key,
  questions: STORAGE_KEY_REGISTRY.questions.key,
  answerHistory: STORAGE_KEY_REGISTRY.answerHistory.key,
  questionStates: STORAGE_KEY_REGISTRY.questionStates.key,
  mistakeNotes: STORAGE_KEY_REGISTRY.mistakeNotes.key,
  questionAnnotations: STORAGE_KEY_REGISTRY.questionAnnotations.key,
  correctionSuggestions: STORAGE_KEY_REGISTRY.correctionSuggestions.key,
  questionQualityProposals:
    STORAGE_KEY_REGISTRY.questionQualityProposals.key,
  aiPromptTemplates: STORAGE_KEY_REGISTRY.aiPromptTemplates.key,
  dailyTimeBudget: STORAGE_KEY_REGISTRY.dailyTimeBudget.key,
  activeSession: STORAGE_KEY_REGISTRY.activeSession.key,
  transactionJournal: STORAGE_KEY_REGISTRY.transactionJournal.key,
  questionSeedVersion: STORAGE_KEY_REGISTRY.questionSeedVersion.key,
  uiGuideSeen: STORAGE_KEY_REGISTRY.uiGuideSeen.key,
  legacyHistory: STORAGE_KEY_REGISTRY.legacyHistory.key,
  geminiApiKey: STORAGE_KEY_REGISTRY.geminiApiKey.key,
  geminiModel: STORAGE_KEY_REGISTRY.geminiModel.key,
} as const;

const registeredKeys = new Set<string>(
  Object.values(STORAGE_KEY_REGISTRY).map(({ key }) => key),
);

export const isRegisteredStorageKey = (key: string): boolean =>
  registeredKeys.has(key);

export const storageLabelForKey = (key: string): string =>
  Object.values(STORAGE_KEY_REGISTRY).find((definition) => definition.key === key)
    ?.label ?? "端末内データ";

export const BACKUP_STORAGE_DEFINITIONS = Object.values(
  STORAGE_KEY_REGISTRY,
).filter((definition) => definition.backup);

