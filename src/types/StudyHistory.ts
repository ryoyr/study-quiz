import type { QuestionType } from "./Question";

export interface StudyHistory {
  id: string;
  questionId: string;
  category: string;
  /** 旧 single 回答との互換フィールド。text は -1。 */
  selectedIndex: number;
  selectedIndices?: number[];
  textAnswer?: string;
  /** 回答時点の方式。旧履歴では省略される。 */
  answerType?: QuestionType;
  correct: boolean;
  answeredAt: string;
  responseTimeSeconds: number;
  instantScore: number;
  fsrsRating?: "AGAIN" | "HARD" | "GOOD" | "EASY";
}

