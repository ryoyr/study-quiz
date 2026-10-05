import { useMemo, useState } from "react";
import type { Question } from "../types/Question";
import type { CorrectionSuggestion } from "../types/CorrectionSuggestion";
import { addCorrectionSuggestion } from "../services/correctionSuggestionStorage";
import {
  buildBatchFactCheckPrompt,
  parseFactCheckFindings,
  type FactCheckFinding,
} from "../services/batchFactCheckService";
type Props = {
  questions: Question[];
  suggestions: CorrectionSuggestion[];
  onSuggestionsChange: (items: CorrectionSuggestion[]) => void;
  onBack: () => void;
};
export default function BatchFactCheckPage({
  questions,
  suggestions,
  onSuggestionsChange,
  onBack,
}: Props) {
  const [category, setCategory] = useState("ALL");
  const [limit, setLimit] = useState(20);
  const [resultText, setResultText] = useState("");
  const [findings, setFindings] = useState<FactCheckFinding[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const categories = ["ALL", ...new Set(questions.map((q) => q.category))];
  const targets = useMemo(
    () =>
      questions
        .filter((q) => category === "ALL" || q.category === category)
        .slice(0, limit),
    [questions, category, limit],
  );
  const prompt = useMemo(() => buildBatchFactCheckPrompt(targets), [targets]);
  const parse = () => {
    setError("");
    try {
      setFindings(parseFactCheckFindings(resultText, targets));
    } catch (e) {
      setFindings([]);
      setError(e instanceof Error ? e.message : "解析に失敗しました。");
    }
  };
  const register = () => {
    let next = suggestions;
    findings
      .filter((item) => item.status === "needs_correction")
      .forEach((item) => {
        next = addCorrectionSuggestion(next, {
          questionId: item.questionId,
          suggestion: item.suggestion || item.summary,
          reason: `一括ファクトチェック結果: ${item.reason || item.summary}`,
          reference: item.reference,
        });
      });
    onSuggestionsChange(next);
    setMessage(
      `${findings.filter((item) => item.status === "needs_correction").length}件を未確認の修正提案として登録しました。`,
    );
  };
  return (
    <main className="app-shell">
      <section className="home-card fact-check-card">
        <p className="eyebrow">BATCH FACT CHECK</p>
        <h1>一括ファクトチェック支援</h1>
        <p className="planning-note">
          外部AIへ自動送信しません。プロンプトをコピーして確認後、JSON結果を貼り付けてください。
        </p>
        <div className="fact-check-controls">
          <label>
            <span>カテゴリ</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {categories.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            <span>対象上限</span>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            >
              <option value={10}>10問</option>
              <option value={20}>20問</option>
              <option value={50}>50問</option>
            </select>
          </label>
        </div>
        <div className="fact-check-section">
          <h2>1. 確認用プロンプト</h2>
          <textarea rows={12} readOnly value={prompt} />
          <button
            className="primary-button"
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(prompt);
                setError("");
                setMessage(
                  `${targets.length}問分のプロンプトをコピーしました。`,
                );
              } catch {
                setMessage("");
                setError(
                  "コピーできませんでした。プロンプト欄を選択してコピーしてください。",
                );
              }
            }}
          >
            プロンプトをコピー
          </button>
        </div>
        <div className="fact-check-section">
          <h2>2. AIのJSON結果を貼り付け</h2>
          <textarea
            rows={10}
            value={resultText}
            onChange={(e) => setResultText(e.target.value)}
            placeholder='[{"questionId":"Q001","status":"ok",...}]'
          />
          <button
            className="secondary-button"
            type="button"
            disabled={!resultText.trim()}
            onClick={parse}
          >
            JSONを検証・プレビュー
          </button>
        </div>
        {findings.length > 0 && (
          <div className="fact-check-findings">
            <h2>3. 利用者確認</h2>
            {findings.map((item) => (
              <article
                key={item.questionId}
                className={`finding-${item.status}`}
              >
                <div>
                  <strong>{item.questionId}</strong>
                  <b>{item.status}</b>
                </div>
                <p>{item.summary}</p>
                {item.suggestion && <small>修正案: {item.suggestion}</small>}
                {item.reference && <small>参考: {item.reference}</small>}
              </article>
            ))}
            <button
              className="primary-button"
              type="button"
              disabled={
                !findings.some((item) => item.status === "needs_correction")
              }
              onClick={register}
            >
              修正必要分を提案として登録
            </button>
          </div>
        )}
        {message && (
          <div className="backup-success" role="status">
            {message}
          </div>
        )}
        {error && (
          <div className="error-box" role="alert">
            {error}
          </div>
        )}
        <button className="secondary-button" type="button" onClick={onBack}>
          前のメニューへ戻る
        </button>
      </section>
    </main>
  );
}
