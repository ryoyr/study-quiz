import type { QuestionType } from "./Question";

/** 回答後に問題が編集・削除されても、回答時点の履歴表示を維持する最小情報。 */
export interface StudyHistoryQuestionSnapshot {
  questionText: string;
  answerType: QuestionType;
  responseText: string;
  correctAnswerText: string;
}

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
  /** 回答時点の表示内容。旧履歴では省略され、現行問題から表示する。 */
  questionSnapshot?: StudyHistoryQuestionSnapshot;
  correct: boolean;
  answeredAt: string;
  responseTimeSeconds: number;
  instantScore: number;
  fsrsRating?: "AGAIN" | "HARD" | "GOOD" | "EASY";
}

