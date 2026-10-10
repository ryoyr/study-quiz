import type { Question } from "./Question";
export type SourceType = "REVIEW" | "WEAK" | "NEW" | "CUSTOM";
export interface StudySessionItem {
  order: number;
  question: Question;
  primarySourceType: SourceType;
  sourceTypes: SourceType[];
  priorityScore: number;
}
export interface GeneratedStudySession {
  id: string;
  createdAt: string;
  items: StudySessionItem[];
  newCount: number;
  reviewCount: number;
  weakCount: number;
  otherCount: number;
  totalCount: number;
  estimatedMinutes: number;
  remainingNewQuestions: number;
  effectiveDays: number;
  requiredNewCount: number;
}
