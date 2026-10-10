import { useMemo, useState } from "react";
import ConfirmDialog from "../components/ConfirmDialog";
import type { Question } from "../types/Question";
import type {
  QuestionQualityProposal,
  QuestionQualityProposalStatus,
} from "../types/QuestionQualityProposal";
import { createQuestionSeedUpdatePack } from "../services/questionQualityService";
import { reviewQuestionQualityProposal } from "../services/questionQualityProposalStorage";

const STATUS_LABEL: Record<QuestionQualityProposalStatus, string> = {
  pending: "未確認",
  applied: "適用済み",
  rejected: "却下",
};
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
  onApply: (proposalId: string) => boolean;
  onOpenGenerator: () => void;
  onBack: () => void;
};

export default function QuestionQualityReviewPage({
  questions,
  proposals,
  onChange,
  onApply,
  onOpenGenerator,
  onBack,
}: Props) {
  const [filter, setFilter] = useState<"all" | QuestionQualityProposalStatus>("pending");
  const [pendingApply, setPendingApply] = useState<QuestionQualityProposal | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const currentById = useMemo(
    () => new Map(questions.map((question) => [question.id, question])),
    [questions],
  );
  const visible = useMemo(
    () => proposals.filter((item) => filter === "all" || item.status === filter),
    [filter, proposals],
  );
  const appliedCount = proposals.filter((item) => item.status === "applied").length;
  const review = (id: string, status: "pending" | "rejected") => {
    try {
      if (!onChange(reviewQuestionQualityProposal(proposals, id, status))) return;
      setError("");
      setMessage(status === "rejected" ? "品質提案を却下しました。" : "品質提案を未確認へ戻しました。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "品質提案を更新できませんでした。");
    }
  };
  const apply = () => {
    if (!pendingApply) return;
    if (!onApply(pendingApply.id)) {
      setError("品質提案を適用できませんでした。画面上部のエラーを確認してください。");
      setPendingApply(null);
      return;
    }
    setError("");
    setMessage("品質提案を実行環境の問題データへ適用しました。適用前後の内容は提案履歴に保持されています。");
    setPendingApply(null);
  };

  return (
    <main className="app-shell">
      <section className="home-card correction-card">
        <p className="eyebrow">QUALITY REVIEW</p>
        <h1>問題・解説品質提案レビュー</h1>
        <p className="planning-note">
          変更前と提案後を比較してから適用します。未確認の提案だけが問題データを更新でき、提案作成後に問題が変更されている場合は適用を停止します。
        </p>
        <div className="correction-filter">
          <span>提案一覧</span>
          <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
            <option value="pending">未確認</option>
            <option value="applied">適用済み</option>
            <option value="rejected">却下</option>
            <option value="all">すべて</option>
          </select>
        </div>
        <div className="correction-list">
          {visible.map((item) => {
            const current = currentById.get(item.questionId);
            const stale = item.status === "pending" && JSON.stringify(current) !== JSON.stringify(item.beforeQuestion);
            return (
              <article key={item.id} className={`correction-item status-${item.status}`}>
                <div className="correction-heading">
                  <div>
                    <span>{item.questionId} / {item.kind === "correction" ? "修正提案" : "補足提案"}</span>
                    <strong>{item.summary}</strong>
                  </div>
                  <b>{STATUS_LABEL[item.status]}</b>
                </div>
                {stale && <p className="backup-destructive-note" role="alert">提案作成後に現在の問題が変更されています。再提案が必要です。</p>}
                <dl>
                  <dt>変更前の問題文</dt><dd>{item.beforeQuestion.text}</dd>
                  <dt>提案後の問題文</dt><dd>{item.proposedQuestion.text}</dd>
                  <dt>変更前の解説</dt><dd>{item.beforeQuestion.explanation}</dd>
                  <dt>提案後の解説</dt><dd>{item.proposedQuestion.explanation}</dd>
                  <dt>理由</dt><dd>{item.reason}</dd>
                  {item.reference && <><dt>参考情報</dt><dd>{item.reference}</dd></>}
                  {item.appliedAt && <><dt>適用日時</dt><dd>{new Date(item.appliedAt).toLocaleString("ja-JP")}</dd></>}
                </dl>
                <div className="correction-actions">
                  {item.status === "pending" && (
                    <button
                      className="apply-correction-button"
                      type="button"
                      disabled={stale || !current}
                      onClick={() => setPendingApply(item)}
                    >
                      レビュー済みとして適用
                    </button>
                  )}
                  {item.status !== "applied" && (
                    <button type="button" onClick={() => review(item.id, "rejected")}>却下</button>
                  )}
                  {item.status === "rejected" && (
                    <button type="button" onClick={() => review(item.id, "pending")}>未確認へ戻す</button>
                  )}
                </div>
              </article>
            );
          })}
          {visible.length === 0 && <div className="empty-state">該当する品質提案はありません。</div>}
        </div>
        <section className="hub-footnote-card" aria-label="初期データへの反映">
          <strong>今後の初期データへ反映</strong>
          <span>適用済み {appliedCount}件</span>
          <small>
            初期データ更新JSONを出力し、リポジトリで `node tools/apply_question_seed_updates.mjs ファイル.json` を実行すると、新規環境の初期問題へ反映できます。
          </small>
          <button
            className="primary-button"
            type="button"
            disabled={appliedCount === 0}
            onClick={() =>
              downloadJson(
                createQuestionSeedUpdatePack(proposals),
                `study-quiz-question-seed-updates-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
              )
            }
          >
            適用済みの初期データ更新JSONを出力
          </button>
        </section>
        {message && <div className="backup-success" role="status">{message}</div>}
        {error && <div className="error-box" role="alert">{error}</div>}
        <button className="secondary-button" type="button" onClick={onOpenGenerator}>
          品質提案を生成・取込
        </button>
        <button className="secondary-button" type="button" onClick={onBack}>
          前のメニューへ戻る
        </button>
      </section>
      <ConfirmDialog
        open={pendingApply !== null}
        title="品質提案を問題データへ適用しますか？"
        description={pendingApply ? `${pendingApply.questionId} の問題・解説を提案後の内容へ更新します。変更前内容は提案履歴に保持されます。` : ""}
        confirmLabel="提案を適用"
        onConfirm={apply}
        onCancel={() => setPendingApply(null)}
      />
    </main>
  );
}
