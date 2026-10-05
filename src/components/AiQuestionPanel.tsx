import { useMemo, useState } from "react";
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

  const prompt = useMemo(
    () =>
      [
        "資格試験の学習支援として日本語で回答してください。根拠が不明な内容は断定せず、必要なら公式情報の確認を促してください。",
        `カテゴリ: ${question.category}`,
        question.subcategory ? `サブカテゴリ: ${question.subcategory}` : "",
        `問題: ${question.text}`,
        ...question.choices.map(
          (choice, index) => `選択肢${index + 1}: ${choice}`,
        ),
        `正解: 選択肢${question.answerIndex + 1} ${question.choices[question.answerIndex]}`,
        `利用者の回答: ${selectedIndex === null ? "未回答" : `選択肢${selectedIndex + 1} ${question.choices[selectedIndex]}`}`,
        `既存解説: ${question.explanation || "なし"}`,
        question.source ? `出典: ${question.source}` : "",
        `質問: ${request}`,
      ]
        .filter(Boolean)
        .join("\n"),
    [question, request, selectedIndex],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setMessage("質問文をコピーしました。利用するAIへ貼り付けてください。");
    } catch {
      setMessage(
        "コピーできませんでした。下の質問文を選択してコピーしてください。",
      );
    }
  };

  return (
    <section className="ai-question-panel">
      <button
        className="ai-open-button"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        AIに質問するための文を作る
      </button>
      {open && (
        <div className="ai-question-body">
          <p className="security-note">
            APIキーや学習データを保存・送信せず、質問文だけを作成します。
          </p>
          <div className="ai-template-chips" aria-label="質問テンプレート">
            {templates.map((item) => (
              <button
                type="button"
                key={item}
                aria-pressed={request === item}
                onClick={() => setRequest(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <label className="form-item">
            <span>聞きたいこと</span>
            <textarea
              value={request}
              onChange={(event) => setRequest(event.target.value)}
              rows={3}
            />
          </label>
          <textarea
            className="prompt-preview"
            aria-label="生成した質問文"
            rows={10}
            readOnly
            value={prompt}
          />
          <button
            className="primary-button"
            type="button"
            disabled={!request.trim()}
            onClick={() => void copy()}
          >
            質問文をコピー
          </button>
          {message && (
            <div className="backup-success" role="status">
              {message}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
