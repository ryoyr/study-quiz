
import type { Question } from '../types/Question';

const KEY = 'study-quiz-gemini-api-key-v1';
const MODEL_KEY = 'study-quiz-gemini-model-v1';
export const loadGeminiApiKey = () => localStorage.getItem(KEY) ?? '';
export const saveGeminiApiKey = (value: string) => localStorage.setItem(KEY, value.trim());
export const deleteGeminiApiKey = () => localStorage.removeItem(KEY);
export const loadGeminiModel = () => localStorage.getItem(MODEL_KEY) ?? 'gemini-2.5-flash';
export const saveGeminiModel = (value: string) => localStorage.setItem(MODEL_KEY, value.trim());

const api = async (apiKey: string, model: string, prompt: string): Promise<string> => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }),
      signal: controller.signal,
    });
    const body = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; error?: { message?: string } };
    if (!response.ok) throw new Error(body.error?.message ?? `Gemini API error (${response.status})`);
    const text = body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('\n').trim();
    if (!text) throw new Error('Geminiから回答本文を取得できませんでした。');
    return text;
  } finally { window.clearTimeout(timeout); }
};

export const testGeminiConnection = (apiKey: string, model: string) => api(apiKey, model, '接続確認です。「接続成功」とだけ回答してください。');
export const askGeminiForQuestion = (apiKey: string, model: string, question: Question, selectedIndex: number | null, userPrompt: string) => {
  const context = [
    '資格試験の学習支援として、根拠が不明な内容は断定せず日本語で回答してください。',
    `カテゴリ: ${question.category}`,
    `問題: ${question.text}`,
    ...question.choices.map((choice, index) => `選択肢${index + 1}: ${choice}`),
    `正解: 選択肢${question.answerIndex + 1} ${question.choices[question.answerIndex]}`,
    `利用者の回答: ${selectedIndex === null ? '未回答' : `選択肢${selectedIndex + 1} ${question.choices[selectedIndex]}`}`,
    `既存解説: ${question.explanation || 'なし'}`,
    `質問: ${userPrompt}`,
  ].join('\n');
  return api(apiKey, model, context);
};
