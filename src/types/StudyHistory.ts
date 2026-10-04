

export interface StudyHistory {
  id: string;
  questionId: string;
  category: string;
  selectedIndex: number;
  correct: boolean;
  answeredAt: string;
  responseTimeSeconds: number;
  instantScore: number;
  fsrsRating?: 'AGAIN' | 'HARD' | 'GOOD' | 'EASY';
}
