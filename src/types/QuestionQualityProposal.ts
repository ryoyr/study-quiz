import type { Question } from "./Question";

export type QuestionQualityProposalKind = "correction" | "supplement";
export type QuestionQualityProposalStatus = "pending" | "applied" | "rejected";

export interface QuestionQualityProposal {
  id: string;
  questionId: string;
  kind: QuestionQualityProposalKind;
  summary: string;
  reason: string;
  reference: string;
  beforeQuestion: Question;
  proposedQuestion: Question;
  status: QuestionQualityProposalStatus;
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string;
  appliedAt?: string;
}

export interface QuestionQualityProposalInput {
  questionId: string;
  kind: QuestionQualityProposalKind;
  summary: string;
  reason: string;
  reference: string;
  proposed: Partial<
    Pick<
      Question,
      | "text"
      | "questionType"
      | "choices"
      | "answerIndex"
      | "answerIndices"
      | "acceptedAnswers"
      | "explanation"
      | "source"
      | "tags"
      | "weight"
      | "difficulty"
    >
  >;
}

export interface QuestionSeedUpdate {
  questionId: string;
  proposalId: string;
  appliedAt: string;
  beforeQuestion: Question;
  question: Question;
}

export interface QuestionSeedUpdatePack {
  format: "study-quiz-question-seed-updates";
  version: 1;
  appVersion: string;
  exportedAt: string;
  updates: QuestionSeedUpdate[];
}
