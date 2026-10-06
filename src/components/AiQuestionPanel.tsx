import { useMemo, useState } from "react";
import {
  generateGeminiContent,
  isGeminiConfigured,
} from "../services/geminiService";
import type { Question } from "../types/Question";

type Props = { question: Question; selectedIndex: number | null };

const templates = [
  "なぜこの答えになるか、根拠から説明してください。",
  "各選択肢が正しいか誤りかを比較してください。",
  "試験直前に思い出せる覚え方を作ってください。",
  "関連知識と、よくある引っかけを説明してください。",
];

export default function AiQuestionPanel({ question, selectedIndex }: Props) {
  const [open, setOpen] = useState(false);
  const [request, setRequest] = useState(templates[0]);
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  const prompt = useMemo(
    () =>
      [
        "資格試験の学習支援として日本語で回答してください。根拠が不明な内容は断定せず、必要なら公式情報の確認を促してください。",
        `カテゴリ: ${question.category}`,
        question.subcategory ? `サブカテゴリ: ${question.subcategory}` : "",
        `問題: ${question.text}`,
        ...question.choices.map((choice, index) => `選択肢${index + 1}: ${choice}`),
        `正解: 選択肢${question.answerIndex + 1} ${question.choices[question.answerIndex]}`,
        `利用者の回答: ${selectedIndex === null ? "未回答" : `選択肢${selectedIndex + 1} ${question.choices[selectedIndex]}`}`,
        `既存解説: ${question.explanation || "なし"}`,
        question.source ? `出典情報: ${question.source}` : "",
        `質問: ${request}`,
      ]
        .filter(Boolean)
        .join("\n"),
    [question, request, selectedIndex],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setMessage("質問文をコピーしました。");
      setError("");
    } catch {
      setError("コピーできませんでした。下の質問文を選択してコピーしてください。");
    }
  };

  const send = async () => {
    if (sending || !request.trim()) return;
    setSending(true);
    setMessage("");
    setError("");
    setResponse("");
    try {
      setResponse(await generateGeminiContent(prompt));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "AIへの送信に失敗しました。");
    } finally {
      setSending(false);
    }
  };

  const configured = open && isGeminiConfigured();

  return (
    <section className="ai-question-panel">
      <button className="ai-open-button" type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
        AIに質問する
      </button>
      {open && (
        <div className="ai-question-body">
          <p className="security-note">
            {configured
              ? "問題・選択肢・解説と入力した質問をGemini APIへ送信します。"
              : "APIキーが未設定のため、質問文のコピーのみ利用できます。その他 → 設定からGeminiを設定できます。"}
          </p>
          <div className="ai-template-chips" aria-label="質問テンプレート">
            {templates.map((item) => (
              <button type="button" key={item} aria-pressed={request === item} onClick={() => setRequest(item)}>
                {item}
              </button>
            ))}
          </div>
          <label className="form-item">
            <span>聞きたいこと</span>
            <textarea value={request} onChange={(event) => setRequest(event.target.value)} rows={3} />
          </label>
          <details className="prompt-details">
            <summary>送信内容を確認</summary>
            <textarea className="prompt-preview" aria-label="生成した質問文" rows={10} readOnly value={prompt} />
          </details>
          <div className="ai-question-actions">
            {configured && (
              <button className="primary-button" type="button" disabled={sending || !request.trim()} onClick={() => void send()}>
                {sending ? "AIへ送信中..." : "Geminiへ送信"}
              </button>
            )}
            <button className="secondary-button" type="button" disabled={!request.trim()} onClick={() => void copy()}>
              質問文をコピー
            </button>
          </div>
          {response && (
            <article className="ai-answer" aria-live="polite">
              <strong>Geminiの回答</strong>
              <p>{response}</p>
            </article>
          )}
          {message && <div className="backup-success" role="status">{message}</div>}
          {error && <div className="error-box" role="alert">{error}</div>}
        </div>
      )}
    </section>
  );
}
