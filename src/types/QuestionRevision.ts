import type { Question } from "./Question";

export type QuestionRevisionSource =
  | "manual"
  | "quality-proposal"
  | "correction-suggestion"
  | "import"
  | "master-sync";

export interface QuestionRevision {
  id: string;
  questionId: string;
  source: QuestionRevisionSource;
  summary: string;
  changedFields: string[];
  before: Question | null;
  after: Question;
  createdAt: string;
  proposalId?: string;
}
