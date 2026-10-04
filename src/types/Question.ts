export interface Question {
  id: string;

  category: string;

  text: string;

  choices: string[];

  answerIndex: number;

  explanation: string;

  weight: number;

  difficulty: number;
}