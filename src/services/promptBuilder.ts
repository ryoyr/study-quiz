
import type { Question } from '../types/Question';

export const buildQuestionContext = (question: Question): string => [
  `カテゴリ: ${question.category}`,
  question.subcategory ? `サブカテゴリ: ${question.subcategory}` : '',
  `問題: ${question.text}`,
  ...question.choices.map((choice, index) => `選択肢${index + 1}: ${choice}`),
  `正解: 選択肢${question.answerIndex + 1} ${question.choices[question.answerIndex]}`,
  `既存解説: ${question.explanation || 'なし'}`,
  question.source ? `出典: ${question.source}` : '',
  question.tags?.length ? `タグ: ${question.tags.join(', ')}` : '',
  `重要度: ${question.weight}`,
  `難易度: ${question.difficulty}`,
].filter(Boolean).join('\n');

export const buildPrompt = (template: string, question: Question): string => template.includes('{{questionContext}}')
  ? template.replaceAll('{{questionContext}}', buildQuestionContext(question))
  : `${template}\n\n${buildQuestionContext(question)}`;
