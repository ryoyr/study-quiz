import { useState } from 'react';
import type { Question } from '../types/Question';
import { askGeminiForQuestion, loadGeminiApiKey, loadGeminiModel } from '../services/geminiService';
type Props = { question: Question; selectedIndex: number | null };
const templates = ['なぜこの答えになる？', '各選択肢の違いを説明して', '試験での覚え方を教えて', '関連知識を教えて'];
export default function AiQuestionPanel({ question, selectedIndex }: Props) {
  const [open, setOpen] = useState(false); const [prompt, setPrompt] = useState(templates[0]); const [result, setResult] = useState(''); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const ask = async () => { const key = loadGeminiApiKey(); if (!key) { setError('設定タブでGemini APIキーを保存してください。'); return; } setLoading(true); setError(''); try { setResult(await askGeminiForQuestion(key, loadGeminiModel(), question, selectedIndex, prompt)); } catch (e) { setError(e instanceof Error ? e.message : 'Geminiへの質問に失敗しました。'); } finally { setLoading(false); } };
  return <section className="ai-question-panel"><button className="ai-open-button" type="button" onClick={() => setOpen(!open)}>✦ Geminiに詳しく聞く</button>{open && <div className="ai-question-body"><div className="ai-template-chips">{templates.map((item) => <button type="button" key={item} onClick={() => setPrompt(item)}>{item}</button>)}</div><textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3}/><button className="primary-button" type="button" disabled={loading || !prompt.trim()} onClick={() => void ask()}>{loading ? '質問中...' : 'この問題について質問する'}</button>{error && <div className="error-box">{error}</div>}{result && <div className="ai-result"><strong>Geminiの回答</strong><p>{result}</p><small>AIの回答は誤る場合があります。公式情報も確認してください。</small></div>}</div>}</section>;
}
