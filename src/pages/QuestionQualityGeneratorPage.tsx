import { useMemo, useRef, useState } from "react";
import type { Question } from "../types/Question";
import type { QuestionQualityProposal } from "../types/QuestionQualityProposal";
import {
  addQuestionQualityProposals,
} from "../services/questionQualityProposalStorage";
import {
  buildQuestionQualityPrompt,
  createQualityInput,
  parseQuestionQualityProposals,
} from "../services/questionQualityService";

const MAX_JSON_BYTES = 5 * 1024 * 1024;
const downloadJson = (value: unknown, name: string) => {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

type Props = {
  questions: Question[];
  proposals: QuestionQualityProposal[];
  onChange: (items: QuestionQualityProposal[]) => boolean;
  onOpenReview: () => void;
  onBack: () => void;
};

export default function QuestionQualityGeneratorPage({
  questions,
  proposals,
  onChange,
  onOpenReview,
  onBack,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState("ALL");
  const [limit, setLimit] = useState(20);
  const [resultText, setResultText] = useState("");
  const [preview, setPreview] = useState<QuestionQualityProposal[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const categories = ["ALL", ...new Set(questions.map((item) => item.category))];
  const targets = useMemo(
    () =>
      questions
        .filter((item) => category === "ALL" || item.category === category)
        .slice(0, limit),
    [category, limit, questions],
  );
  const prompt = useMemo(() => buildQuestionQualityPrompt(targets), [targets]);

  const parse = () => {
    setError("");
    setMessage("");
    try {
      setPreview(parseQuestionQualityProposals(resultText, targets));
    } catch (cause) {
      setPreview([]);
      setError(cause instanceof Error ? cause.message : "品質提案JSONを解析できませんでした。");
    }
  };
  const register = () => {
    try {
      const next = addQuestionQualityProposals(proposals, preview);
      if (!onChange(next)) return;
      setPreview([]);
      setResultText("");
      setMessage(`${preview.length}件を未確認の品質提案として登録しました。`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "品質提案を登録できませんでした。");
    }
  };
  const readResultFile = async (file: File) => {
    setError("");
    if (file.size > MAX_JSON_BYTES) {
      setError("品質提案JSONは5MB以下にしてください。");
      return;
    }
    try {
      setResultText(await file.text());
      setPreview([]);
      setMessage(`${file.name}を読み込みました。内容を検証してください。`);
    } catch {
      setError("品質提案JSONを読み取れませんでした。");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <main className="app-shell">
      <section className="home-card fact-check-card">
        <p className="eyebrow">QUESTION QUALITY</p>
        <h1>問題・解説の品質向上</h1>
        <p className="planning-note">
          ファクトチェックと同じコピー方式で、問題文・正答・解説の修正案または補足案をJSONで作成します。提案登録だけでは問題データを変更しません。
        </p>
        <div className="fact-check-controls">
          <label>
            <span>カテゴリ</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              {categories.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span>対象上限</span>
            <select value={limit} onChange={(event) => setLimit(Number(event.target.value))}>
              <option value={10}>10問</option>
              <option value={20}>20問</option>
              <option value={50}>50問</option>
            </select>
          </label>
        </div>
        <div className="fact-check-section">
          <h2>1. 入力JSON・確認プロンプト</h2>
          <button
            className="secondary-button"
            type="button"
            disabled={targets.length === 0}
            onClick={() =>
              downloadJson(
                createQualityInput(targets),
                `study-quiz-quality-input-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
              )
            }
          >
            対象問題JSONを出力
          </button>
          <textarea rows={14} readOnly value={prompt} />
          <button
            className="primary-button"
            type="button"
            disabled={targets.length === 0}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(prompt);
                setError("");
                setMessage(`${targets.length}問分の品質確認プロンプトをコピーしました。`);
              } catch {
                setError("コピーできませんでした。プロンプト欄を選択してコピーしてください。");
              }
            }}
          >
            品質確認プロンプトをコピー
          </button>
        </div>
        <div className="fact-check-section">
          <h2>2. 提案JSONを入力</h2>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            aria-label="取り込む問題品質提案JSON"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void readResultFile(file);
            }}
          />
          <textarea
            rows={12}
            value={resultText}
            onChange={(event) => setResultText(event.target.value)}
            placeholder='{"format":"study-quiz-question-quality-proposals","version":1,"proposals":[...]}'
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
        {preview.length > 0 && (
          <section className="fact-check-findings" aria-label="品質提案プレビュー">
            <h2>3. 登録前プレビュー</h2>
            {preview.map((item) => (
              <article key={item.id} className="finding-needs_correction">
                <div><strong>{item.questionId}</strong><b>{item.kind === "correction" ? "修正" : "補足"}</b></div>
                <p>{item.summary}</p>
                <small>変更前: {item.beforeQuestion.text}</small>
                <small>変更後: {item.proposedQuestion.text}</small>
                <small>変更前解説: {item.beforeQuestion.explanation}</small>
                <small>変更後解説: {item.proposedQuestion.explanation}</small>
              </article>
            ))}
            <button className="primary-button" type="button" onClick={register}>
              未確認の品質提案として登録（{preview.length}件）
            </button>
          </section>
        )}
        {message && <div className="backup-success" role="status">{message}</div>}
        {error && <div className="error-box" role="alert">{error}</div>}
        <button className="secondary-button" type="button" onClick={onOpenReview}>
          品質提案レビューを開く
        </button>
        <button className="secondary-button" type="button" onClick={onBack}>
          前のメニューへ戻る
        </button>
      </section>
    </main>
  );
}
