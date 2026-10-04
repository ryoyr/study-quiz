
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
}
