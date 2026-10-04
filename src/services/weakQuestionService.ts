
import type { Question } from '../types/Question';
import type { StudyHistory } from '../types/StudyHistory';

export interface WeakQuestionCandidate {
  question: Question;
  weaknessScore: number;
  answerCount: number;
  accuracyRate: number;
  averageInstantScore: number;
  recentIncorrect: boolean;
}

const average = (values: number[]): number =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

export const analyzeWeakQuestions = (
  questions: Question[],
  history: StudyHistory[],
): WeakQuestionCandidate[] => {
  return questions
    .map((question) => {
      const answers = history
        .filter((item) => item.questionId === question.id)
        .sort((a, b) => b.answeredAt.localeCompare(a.answeredAt));

      if (answers.length === 0) {
        return null;
      }

      const correctCount = answers.filter((item) => item.correct).length;
      const accuracyRate = correctCount / answers.length;
      const averageInstantScore = average(answers.map((item) => item.instantScore));
      const recentIncorrect = !answers[0].correct;
      const accuracyDeficit = 1 - accuracyRate;
      const speedDeficit = 1 - averageInstantScore;
      const recentPenalty = recentIncorrect ? 1 : 0;
      const weaknessScore =
        accuracyDeficit * 0.6 + speedDeficit * 0.2 + recentPenalty * 0.2;

      return {
        question,
        weaknessScore,
        answerCount: answers.length,
        accuracyRate,
        averageInstantScore,
        recentIncorrect,
      };
    })
    .filter((item): item is WeakQuestionCandidate => item !== null)
    .sort((a, b) => {
      if (b.weaknessScore !== a.weaknessScore) {
        return b.weaknessScore - a.weaknessScore;
      }
      return a.question.id.localeCompare(b.question.id);
    });
};

export const selectWeakQuestions = (
  questions: Question[],
  history: StudyHistory[],
  limit: number,
): Question[] =>
  analyzeWeakQuestions(questions, history)
    .filter((item) => item.weaknessScore >= 0.35)
    .slice(0, Math.max(1, limit))
    .map((item) => item.question);
