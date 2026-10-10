import { useMemo, useState } from "react";
import ConfirmDialog from "../components/ConfirmDialog";
import StructuredText from "../components/StructuredText";
import type { Question } from "../types/Question";
import type {
  QuestionQualityProposal,
  QuestionQualityProposalKind,
  QuestionQualityProposalStatus,
} from "../types/QuestionQualityProposal";
import {
  buildQuestionQualityRegenerationPrompt,
  createQuestionSeedUpdatePack,
} from "../services/questionQualityService";
import { reviewQuestionQualityProposal } from "../services/questionQualityProposalStorage";
import {
  formatCorrectAnswer,
  questionTypeLabel,
} from "../services/questionAnswerModel";

const STATUS_LABEL: Record<QuestionQualityProposalStatus, string> = {
  pending: "未確認",
  applied: "適用済み",
  rejected: "却下",
};
const KIND_LABEL: Record<QuestionQualityProposalKind, string> = {
  correction: "修正提案",
  supplement: "補足提案",
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
const stringifyValue = (value: unknown): string => {
  if (value === undefined) return "（なし）";
  if (Array.isArray(value)) return value.join(" / ") || "（空）";
  return String(value);
};

const changedFields = (
  before: Question,
  after: Question,
): Array<{ label: string; before: unknown; after: unknown }> => {
  const fields: Array<[keyof Question, string]> = [
    ["text", "問題文"],
    ["questionType", "回答方式"],
    ["choices", "選択肢"],
    ["answerIndex", "択一正答"],
    ["answerIndices", "複数正答"],
    ["acceptedAnswers", "許容回答"],
    ["explanation", "解説"],
    ["source", "出典"],
    ["tags", "タグ"],
    ["weight", "ウェイト"],
    ["difficulty", "難易度"],
  ];
  return fields
    .filter(
      ([field]) =>
        JSON.stringify(before[field]) !== JSON.stringify(after[field]),
    )
    .map(([field, label]) => ({ label, before: before[field], after: after[field] }));
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
  const [filter, setFilter] =
    useState<"all" | QuestionQualityProposalStatus>("pending");
  const [kindFilter, setKindFilter] =
    useState<"all" | QuestionQualityProposalKind>("all");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [searchText, setSearchText] = useState("");
  const [pendingApply, setPendingApply] =
    useState<QuestionQualityProposal | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const currentById = useMemo(
    () => new Map(questions.map((question) => [question.id, question])),
    [questions],
  );
  const categories = useMemo(
    () => [
      "ALL",
      ...new Set(proposals.map((proposal) => proposal.beforeQuestion.category)),
    ],
    [proposals],
  );
  const visible = useMemo(() => {
    const search = searchText.normalize("NFKC").trim().toLocaleLowerCase();
    return proposals.filter((item) => {
      const searchable = [
        item.questionId,
        item.summary,
        item.reason,
        item.reference,
        item.beforeQuestion.text,
        item.proposedQuestion.text,
      ]
        .join("\n")
        .normalize("NFKC")
        .toLocaleLowerCase();
      return (
        (filter === "all" || item.status === filter) &&
        (kindFilter === "all" || item.kind === kindFilter) &&
        (categoryFilter === "ALL" ||
          item.beforeQuestion.category === categoryFilter) &&
        (!search || searchable.includes(search))
      );
    });
  }, [categoryFilter, filter, kindFilter, proposals, searchText]);
  const statusCounts = useMemo(
    () => ({
      pending: proposals.filter((item) => item.status === "pending").length,
      applied: proposals.filter((item) => item.status === "applied").length,
      rejected: proposals.filter((item) => item.status === "rejected").length,
    }),
    [proposals],
  );

  const review = (id: string, status: "pending" | "rejected") => {
    try {
      if (!onChange(reviewQuestionQualityProposal(proposals, id, status))) return;
      setError("");
      setMessage(
        status === "rejected"
          ? "品質提案を却下しました。"
          : "品質提案を未確認へ戻しました。",
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "品質提案を更新できませんでした。",
      );
    }
  };
  const apply = () => {
    if (!pendingApply) return;
    if (!onApply(pendingApply.id)) {
      setError(
        "品質提案を適用できませんでした。画面上部のエラーを確認してください。",
      );
      setPendingApply(null);
      return;
    }
    setError("");
    setMessage(
      "品質提案を実行環境の問題データへ適用しました。適用前後の内容は提案履歴に保持されています。",
    );
    setPendingApply(null);
  };
  const copyRegenerationPrompt = async (proposal: QuestionQualityProposal) => {
    const current = currentById.get(proposal.questionId) ?? proposal.beforeQuestion;
    try {
      await navigator.clipboard.writeText(
        buildQuestionQualityRegenerationPrompt(current, proposal),
      );
      if (
        proposal.status === "pending" &&
        !onChange(
          reviewQuestionQualityProposal(proposals, proposal.id, "rejected"),
        )
      ) {
        return;
      }
      setError("");
      setMessage(
        proposal.status === "pending"
          ? `${proposal.questionId} の前回提案を却下し、現在問題を基準にした再生成プロンプトをコピーしました。`
          : `${proposal.questionId} の再生成プロンプトをコピーしました。`,
      );
    } catch {
      setError(
        "再生成プロンプトをコピーできませんでした。ブラウザーのクリップボード権限を確認してください。",
      );
    }
  };

  return (
    <main className="app-shell">
      <section className="home-card correction-card quality-review-card">
        <p className="eyebrow">QUALITY REVIEW</p>
        <h1>問題・解説品質提案レビュー</h1>
        <p className="planning-note">
          問題文だけでなく、回答方式、正答、選択肢、解説、出典、難易度を比較して適用・却下します。再生成時は前回案を却下し、現在問題と前回の弱点を含む品質重視プロンプトをコピーできます。
        </p>
        <div className="quality-count-grid" aria-label="提案状態件数">
          <span><strong>{statusCounts.pending}</strong>未確認</span>
          <span><strong>{statusCounts.applied}</strong>適用済み</span>
          <span><strong>{statusCounts.rejected}</strong>却下</span>
          <span><strong>{visible.length}</strong>表示中</span>
        </div>
        <div className="quality-review-filters">
          <label>
            <span>状態</span>
            <select value={filter} data-testid="quality-status-filter" onChange={(event) => setFilter(event.target.value as typeof filter)}>
              <option value="pending">未確認</option>
              <option value="applied">適用済み</option>
              <option value="rejected">却下</option>
              <option value="all">すべて</option>
            </select>
          </label>
          <label>
            <span>提案種別</span>
            <select value={kindFilter} onChange={(event) => setKindFilter(event.target.value as typeof kindFilter)}>
              <option value="all">すべて</option>
              <option value="correction">修正</option>
              <option value="supplement">補足</option>
            </select>
          </label>
          <label>
            <span>カテゴリ</span>
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              {categories.map((category) => (
                <option key={category} value={category}>{category === "ALL" ? "すべて" : category}</option>
              ))}
            </select>
          </label>
          <label>
            <span>ID・要約・問題文検索</span>
            <input value={searchText} onChange={(event) => setSearchText(event.target.value)} />
          </label>
        </div>
        <div className="correction-list">
          {visible.map((item) => {
            const current = currentById.get(item.questionId);
            const stale =
              item.status === "pending" &&
              JSON.stringify(current) !== JSON.stringify(item.beforeQuestion);
            const differences = changedFields(
              item.beforeQuestion,
              item.proposedQuestion,
            );
            return (
              <article
                key={item.id}
                className={`correction-item status-${item.status}`}
              >
                <div className="correction-heading">
                  <div>
                    <span>
                      {item.questionId} / {KIND_LABEL[item.kind]} / {item.beforeQuestion.category}
                    </span>
                    <strong>{item.summary}</strong>
                  </div>
                  <b>{STATUS_LABEL[item.status]}</b>
                </div>
                {stale && (
                  <p className="backup-destructive-note" role="alert">
                    提案作成後に現在の問題が変更されています。現在問題を基準に再生成してください。
                  </p>
                )}
                <div className="quality-answer-comparison">
                  <section data-testid="quality-before">
                    <strong>変更前の問題文・回答・解説</strong>
                    <span>{questionTypeLabel(item.beforeQuestion)} / 難易度 {item.beforeQuestion.difficulty}</span>
                    <p>{item.beforeQuestion.text}</p>
                    <small>選択肢: {item.beforeQuestion.choices.join(" / ") || "なし"}</small>
                    <small>正答: {formatCorrectAnswer(item.beforeQuestion)}</small>
                    <small>解説:</small>
                    <StructuredText text={item.beforeQuestion.explanation} />
                    <small>出典: {item.beforeQuestion.source || "なし"}</small>
                  </section>
                  <section data-testid="quality-after">
                    <strong>提案後の問題文・回答・解説</strong>
                    <span>{questionTypeLabel(item.proposedQuestion)} / 難易度 {item.proposedQuestion.difficulty}</span>
                    <p>{item.proposedQuestion.text}</p>
                    <small>選択肢: {item.proposedQuestion.choices.join(" / ") || "なし"}</small>
                    <small>正答: {formatCorrectAnswer(item.proposedQuestion)}</small>
                    <small>解説:</small>
                    <StructuredText text={item.proposedQuestion.explanation} />
                    <small>出典: {item.proposedQuestion.source || "なし"}</small>
                  </section>
                </div>
                <details className="quality-field-differences" open>
                  <summary>変更項目 {differences.length}件</summary>
                  {differences.map((difference) => (
                    <div key={difference.label}>
                      <strong>{difference.label}</strong>
                      <span>変更前: {stringifyValue(difference.before)}</span>
                      <span>変更後: {stringifyValue(difference.after)}</span>
                    </div>
                  ))}
                </details>
                <dl>
                  <dt>理由</dt><dd>{item.reason}</dd>
                  <dt>参考情報</dt><dd>{item.reference || "記載なし（事実・正答変更の場合は適用前に確認）"}</dd>
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
                  {item.status !== "applied" && (
                    <button type="button" onClick={() => void copyRegenerationPrompt(item)}>
                      {item.status === "pending" ? "却下して再生成プロンプトをコピー" : "再生成プロンプトをコピー"}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
          {visible.length === 0 && (
            <div className="empty-state">該当する品質提案はありません。</div>
          )}
        </div>
        <section className="hub-footnote-card" aria-label="初期データへの反映">
          <strong>今後の初期データへ反映</strong>
          <span>適用済み {statusCounts.applied}件</span>
          <small>
            初期データ更新JSONを出力し、リポジトリで `node tools/apply_question_seed_updates.mjs ファイル.json` を実行すると、新規環境の初期問題へ反映できます。
          </small>
          <button
            className="primary-button"
            type="button"
            disabled={statusCounts.applied === 0}
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
        <button className="secondary-button" type="button" onClick={onOpenGenerator}>品質提案を生成・取込</button>
        <button className="secondary-button" type="button" onClick={onBack}>前のメニューへ戻る</button>
      </section>
      <ConfirmDialog
        open={pendingApply !== null}
        title="品質提案を問題データへ適用しますか？"
        description={
          pendingApply
            ? `${pendingApply.questionId} の問題・回答定義・解説を提案後の内容へ更新します。変更前内容は提案履歴に保持されます。`
            : ""
        }
        confirmLabel="提案を適用"
        onConfirm={apply}
        onCancel={() => setPendingApply(null)}
      />
    </main>
  );
}
