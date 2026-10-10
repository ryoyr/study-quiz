export type QuestionType = "single" | "multiple" | "text";

export interface Question {
  id: string;
  /** カテゴリより上位の試験枠ID。 */
  examScopeId: string;
  category: string;
  subcategory?: string;
  text: string;
  /** 回答方式。省略された旧データは single として扱う。 */
  questionType?: QuestionType;
  choices: string[];
  /** single の正解。旧データ互換のため維持する。 */
  answerIndex: number;
  /** multiple の正解集合。順序は判定に影響しない。 */
  answerIndices?: number[];
  /** text の許容回答。前後空白・Unicode・英字大小を正規化して完全一致する。 */
  acceptedAnswers?: string[];
  explanation: string;
  source?: string;
  tags?: string[];
  weight: number;
  difficulty: number;
  /** 論理削除日時。設定済みの問題は通常の出題対象から除外する。 */
  archivedAt?: string;
}
