export interface Question {
  id: string;
  category: string;
  subcategory?: string;
  text: string;
  choices: string[];
  answerIndex: number;
  explanation: string;
  source?: string;
  tags?: string[];
  weight: number;
  difficulty: number;
  /** 論理削除日時。設定済みの問題は通常の出題対象から除外する。 */
  archivedAt?: string;
}
