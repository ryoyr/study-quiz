
export type CorrectionSuggestionStatus = 'pending' | 'approved' | 'rejected';
export interface CorrectionSuggestion {
  id: string;
  questionId: string;
  suggestion: string;
  reason: string;
  reference: string;
  status: CorrectionSuggestionStatus;
  createdAt: string;
  updatedAt: string;
}
