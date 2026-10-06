import { useMemo, useState } from "react";
import type { Question } from "../types/Question";
import type {
  CorrectionSuggestion,
  CorrectionSuggestionStatus,
} from "../types/CorrectionSuggestion";
import {
  addCorrectionSuggestion,
  changeCorrectionSuggestionStatus,
  deleteCorrectionSuggestion,
} from "../services/correctionSuggestionStorage";
import ConfirmDialog from "../components/ConfirmDialog";

type Props = {
  questions: Question[];
  items: CorrectionSuggestion[];
  initialQuestionId?: string;
  onChange: (items: CorrectionSuggestion[]) => boolean;
  onEditQuestion: (questionId: string) => void;
  onBack: () => void;
};

const STATUS_LABEL: Record<CorrectionSuggestionStatus, string> = {
  pending: "未確認",
  approved: "承認",
  rejected: "却下",
};

export default function CorrectionSuggestionsPage({
  questions,
  items,
  initialQuestionId = "",
  onChange,
  onEditQuestion,
  onBack,
}: Props) {
  const [questionId, setQuestionId] = useState(
    initialQuestionId || questions[0]?.id || "",
  );
  const [suggestion, setSuggestion] = useState("");
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [filter, setFilter] = useState<"all" | CorrectionSuggestionStatus>(
    "all",
  );
  const [message, setMessage] = useState("");
  const [pendingDelete, setPendingDelete] =
    useState<CorrectionSuggestion | null>(null);
  const visible = useMemo(
    () => items.filter((item) => filter === "all" || item.status === filter),
    [items, filter],
  );
  const questionMap = useMemo(
    () => new Map(questions.map((question) => [question.id, question])),
    [questions],
  );

  const submit = () => {
    if (!questionId || !suggestion.trim() || !reason.trim()) return;
    onChange(
      addCorrectionSuggestion(items, {
        questionId,
        suggestion: suggestion.trim(),
        reason: reason.trim(),
        reference: reference.trim(),
      }),
    );
    setSuggestion("");
    setReason("");
    setReference("");
    setMessage("修正提案を保存しました。問題データは変更されていません。");
  };
  const status = (id: string, value: CorrectionSuggestionStatus) =>
    onChange(changeCorrectionSuggestionStatus(items, id, value));
  const approveAndEdit = (item: CorrectionSuggestion) => {
    status(item.id, "approved");
    onEditQuestion(item.questionId);
  };
  const confirmDelete = () => {
    if (!pendingDelete) return;
    if (!onChange(deleteCorrectionSuggestion(items, pendingDelete.id))) {
      setMessage("削除結果を保存できませんでした。端末の空き容量を確認してください。");
      setPendingDelete(null);
      return;
    }
    setMessage("修正提案を削除しました。");
    setPendingDelete(null);
  };

  return (
    <main className="app-shell">
      <section className="home-card correction-card">
        <h1>問題修正提案</h1>
        <p className="planning-note">
          提案を確認し、「承認して問題を編集」から正式な問題データへ反映できます。
        </p>
        <div className="form-grid">
          <label className="form-item">
            <span>対象問題</span>
            <select
              value={questionId}
              onChange={(event) => setQuestionId(event.target.value)}
            >
              {questions.map((question) => (
                <option key={question.id} value={question.id}>
                  {question.category} / {question.text}
                </option>
              ))}
            </select>
          </label>
          <label className="form-item">
            <span>修正内容</span>
            <textarea
              rows={4}
              value={suggestion}
              onChange={(event) => setSuggestion(event.target.value)}
              placeholder="どの記述をどのように修正するか"
            />
          </label>
          <label className="form-item">
            <span>修正理由</span>
            <textarea
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="誤りと判断した理由、改善が必要な理由"
            />
          </label>
          <label className="form-item">
            <span>参考情報（任意）</span>
            <textarea
              rows={2}
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="公式ドキュメント名、URL、書籍など"
            />
          </label>
        </div>
        <button
          className="primary-button"
          type="button"
          disabled={!questionId || !suggestion.trim() || !reason.trim()}
          onClick={submit}
        >
          修正提案を保存
        </button>
        {message && (
          <div className="backup-success" role="status">
            {message}
          </div>
        )}
        <div className="correction-filter">
          <span>提案一覧</span>
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as typeof filter)}
          >
            <option value="all">すべて</option>
            <option value="pending">未確認</option>
            <option value="approved">承認</option>
            <option value="rejected">却下</option>
          </select>
        </div>
        <div className="correction-list">
          {visible.map((item) => {
            const question = questionMap.get(item.questionId);
            return (
              <article
                key={item.id}
                className={`correction-item status-${item.status}`}
              >
                <div className="correction-heading">
                  <div>
                    <span>
                      {question?.category ?? "削除済み問題"} / {item.questionId}
                    </span>
                    <strong>
                      {question?.text ?? "対象問題が見つかりません"}
                    </strong>
                  </div>
                  <b>{STATUS_LABEL[item.status]}</b>
                </div>
                <dl>
                  <dt>修正内容</dt>
                  <dd>{item.suggestion}</dd>
                  <dt>理由</dt>
                  <dd>{item.reason}</dd>
                  {item.reference && (
                    <>
                      <dt>参考情報</dt>
                      <dd>{item.reference}</dd>
                    </>
                  )}
                </dl>
                <div className="correction-actions">
                  {question && (
                    <button
                      className="apply-correction-button"
                      type="button"
                      onClick={() => approveAndEdit(item)}
                    >
                      承認して問題を編集
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => status(item.id, "rejected")}
                  >
                    却下
                  </button>
                  <button
                    type="button"
                    onClick={() => status(item.id, "pending")}
                  >
                    未確認へ戻す
                  </button>
                  <button
                    className="delete-button"
                    type="button"
                    onClick={() => setPendingDelete(item)}
                    aria-label={`問題 ${item.questionId} の修正提案を削除`}
                  >
                    削除
                  </button>
                </div>
              </article>
            );
          })}
          {visible.length === 0 && (
            <div className="empty-state">該当する修正提案はありません。</div>
          )}
        </div>
        <button className="secondary-button" type="button" onClick={onBack}>
          前のメニューへ戻る
        </button>
      </section>
      <ConfirmDialog
        open={pendingDelete !== null}
        title="修正提案を削除しますか？"
        description={
          pendingDelete
            ? `問題 ${pendingDelete.questionId} の修正提案は完全に削除されます。この操作は取り消せません。`
            : ""
        }
        confirmLabel="修正提案を削除"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </main>
  );
}


