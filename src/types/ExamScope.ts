export interface ExamScope {
  id: string;
  certification: string;
  name: string;
  examCode: string;
  version: string;
  description: string;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export const LPIC101_EXAM_SCOPE_ID = "lpic101";

