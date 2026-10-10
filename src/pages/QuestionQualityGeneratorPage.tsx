import { useEffect, useMemo, useRef, useState } from "react";
import type { Question, QuestionType } from "../types/Question";
import type { QuestionQualityProposal } from "../types/QuestionQualityProposal";
import { addQuestionQualityProposals } from "../services/questionQualityProposalStorage";
import {
  buildQuestionQualityPrompt,
  createQualityInput,
  createQuestionQualityBatches,
  parseQuestionQualityProposals,
  planQuestionQualitySelection,
  QUESTION_QUALITY_BATCH_SIZE_OPTIONS,
  type QuestionQualityReviewFocus,
  type QuestionQualitySourceFilter,
} from "../services/questionQualityService";
import {
  formatCorrectAnswer,
  questionTypeLabel,
  questionTypeOf,
} from "../services/questionAnswerModel";

const MAX_JSON_BYTES = 5 * 1024 * 1024;
const REVIEW_FOCUS_LABELS: Record<QuestionQualityReviewFocus, string> = {
  comprehensive: "総合品質",
  facts: "事実・正答・根拠",
  distractors: "誤答選択肢",
  explanation: "解説品質",
};
const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  single: "択一",
  multiple: "複数選択",
  text: "入力",
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

const toggleValue = <T,>(values: T[], value: T): T[] =>
  values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];

const changedFieldLabels = (proposal: QuestionQualityProposal): string[] => {
  const labels: Array<[keyof Question, string]> = [
    ["text", "問題文"],
    ["questionType", "回答方式"],
    ["choices", "選択肢"],
    ["answerIndex", "正答"],
    ["answerIndices", "複数正答"],
    ["acceptedAnswers", "許容回答"],
    ["explanation", "解説"],
    ["source", "出典"],
    ["tags", "タグ"],
    ["weight", "ウェイト"],
    ["difficulty", "難易度"],
  ];
  return labels
    .filter(
      ([field]) =>
        JSON.stringify(proposal.beforeQuestion[field]) !==
        JSON.stringify(proposal.proposedQuestion[field]),
    )
    .map(([, label]) => label);
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
  const categories = useMemo(
    () => [...new Set(questions.map((item) => item.category))],
    [questions],
  );
  const difficulties = useMemo(
    () => [...new Set(questions.map((item) => item.difficulty))].sort(),
    [questions],
  );
  const availableQuestionTypes = useMemo(
    () =>
      (["single", "multiple", "text"] as QuestionType[]).filter((type) =>
        questions.some((question) => questionTypeOf(question) === type),
      ),
    [questions],
  );

  const [selectedCategories, setSelectedCategories] = useState<string[]>(categories);
  const [selectedDifficulties, setSelectedDifficulties] =
    useState<number[]>(difficulties);
  const [selectedQuestionTypes, setSelectedQuestionTypes] =
    useState<QuestionType[]>(availableQuestionTypes);
  const [sourceFilter, setSourceFilter] =
    useState<QuestionQualitySourceFilter>("all");
  const [searchText, setSearchText] = useState("");
  const [excludePending, setExcludePending] = useState(true);
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [batchSize, setBatchSize] = useState(8);
  const [focus, setFocus] =
    useState<QuestionQualityReviewFocus>("comprehensive");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchNumber, setBatchNumber] = useState(1);
  const [resultText, setResultText] = useState("");
  const [preview, setPreview] = useState<QuestionQualityProposal[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const pendingQuestionIds = useMemo(
    () =>
      new Set(
        proposals
          .filter((proposal) => proposal.status === "pending")
          .map((proposal) => proposal.questionId),
      ),
    [proposals],
  );
  const selectionPlan = useMemo(
    () =>
      planQuestionQualitySelection(
        questions,
        {
          categories: selectedCategories,
          difficulties: selectedDifficulties,
          questionTypes: selectedQuestionTypes,
          sourceFilter,
          searchText,
          excludePending,
          offset,
          limit,
        },
        pendingQuestionIds,
      ),
    [
      excludePending,
      limit,
      offset,
      pendingQuestionIds,
      questions,
      searchText,
      selectedCategories,
      selectedDifficulties,
      selectedQuestionTypes,
      sourceFilter,
    ],
  );

  useEffect(() => {
    setSelectedIds(new Set(selectionPlan.pageQuestions.map((item) => item.id)));
    setBatchNumber(1);
    setPreview([]);
    setResultText("");
  }, [selectionPlan.pageQuestions]);

  const selectedQuestions = useMemo(
    () =>
      selectionPlan.pageQuestions.filter((question) => selectedIds.has(question.id)),
    [selectedIds, selectionPlan.pageQuestions],
  );
  const batches = useMemo(
    () => createQuestionQualityBatches(selectedQuestions, batchSize),
    [batchSize, selectedQuestions],
  );
  const currentBatch =
    batches[Math.min(Math.max(batchNumber - 1, 0), Math.max(batches.length - 1, 0))];
  const prompt = useMemo(
    () =>
      currentBatch
        ? buildQuestionQualityPrompt(currentBatch.questions, {
            focus,
            batchNumber: currentBatch.number,
            batchCount: batches.length,
            comparisonQuestions: selectedQuestions,
          })
        : "",
    [batches.length, currentBatch, focus, selectedQuestions],
  );

  useEffect(() => {
    if (batchNumber > batches.length) setBatchNumber(Math.max(1, batches.length));
  }, [batchNumber, batches.length]);

  const resetPaging = () => {
    setOffset(0);
    setError("");
    setMessage("");
  };
  const changeBatch = (value: number) => {
    setBatchNumber(value);
    setPreview([]);
    setResultText("");
    setError("");
    setMessage(`分割${value}の入力へ切り替えました。`);
  };
  const parse = () => {
    setError("");
    setMessage("");
    try {
      if (!currentBatch) throw new Error("品質確認の対象問題を選択してください。");
      setPreview(parseQuestionQualityProposals(resultText, currentBatch.questions));
    } catch (cause) {
      setPreview([]);
      setError(
        cause instanceof Error
          ? cause.message
          : "品質提案JSONを解析できませんでした。",
      );
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
      setError(
        cause instanceof Error
          ? cause.message
          : "品質提案を登録できませんでした。",
      );
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
      setMessage(`${file.name}を読み込みました。現在の分割対象と照合してください。`);
    } catch {
      setError("品質提案JSONを読み取れませんでした。");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <main className="app-shell">
      <section className="home-card fact-check-card quality-generator-card">
        <p className="eyebrow">QUESTION QUALITY</p>
        <h1>問題・解説の品質向上</h1>
        <p className="planning-note">
          対象を確認して小さな単位へ分割し、事実・正答・誤答選択肢・解説・出典・重複を確認する品質重視プロンプトを発行します。外部AIへ自動送信せず、提案登録だけでは問題データを変更しません。
        </p>

        <details className="quality-selection-explanation" open>
          <summary>対象問題の選択ロジック</summary>
          <ol>
            <li>アーカイブ済み問題を除外します。</li>
            <li>カテゴリ、難易度、回答方式、出典、検索語で絞り込みます。</li>
            <li>既定では未確認提案がある問題を除外し、重複提案を防ぎます。</li>
            <li>現在の問題配列順を維持して対象上限ごとに区切ります。</li>
            <li>表示された対象をチェックで調整し、指定した分割サイズでプロンプト化します。</li>
          </ol>
        </details>

        <section className="quality-selection-panel" aria-labelledby="quality-selection-title">
          <h2 id="quality-selection-title">1. 選択条件を設定</h2>
          <div className="quality-filter-grid">
            <fieldset>
              <legend>カテゴリ</legend>
              <div className="quality-filter-actions">
                <button type="button" onClick={() => { setSelectedCategories(categories); resetPaging(); }}>すべて</button>
                <button type="button" onClick={() => { setSelectedCategories([]); resetPaging(); }}>解除</button>
              </div>
              <div className="quality-check-list">
                {categories.map((category) => (
                  <label key={category}>
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(category)}
                      onChange={() => { setSelectedCategories(toggleValue(selectedCategories, category)); resetPaging(); }}
                    />
                    <span>{category}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>難易度</legend>
              <div className="quality-check-list compact">
                {difficulties.map((difficulty) => (
                  <label key={difficulty}>
                    <input
                      type="checkbox"
                      checked={selectedDifficulties.includes(difficulty)}
                      onChange={() => { setSelectedDifficulties(toggleValue(selectedDifficulties, difficulty)); resetPaging(); }}
                    />
                    <span>{difficulty}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>回答方式</legend>
              <div className="quality-check-list compact">
                {availableQuestionTypes.map((type) => (
                  <label key={type}>
                    <input
                      type="checkbox"
                      checked={selectedQuestionTypes.includes(type)}
                      onChange={() => { setSelectedQuestionTypes(toggleValue(selectedQuestionTypes, type)); resetPaging(); }}
                    />
                    <span>{QUESTION_TYPE_LABELS[type]}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="quality-filter-control">
              <span>出典</span>
              <select value={sourceFilter} onChange={(event) => { setSourceFilter(event.target.value as QuestionQualitySourceFilter); resetPaging(); }}>
                <option value="all">指定を問わない</option>
                <option value="present">出典あり</option>
                <option value="missing">出典なし</option>
              </select>
            </label>
            <label className="quality-filter-control">
              <span>ID・問題文・解説・タグ検索</span>
              <input value={searchText} onChange={(event) => { setSearchText(event.target.value); resetPaging(); }} placeholder="例: systemd" />
            </label>
            <label className="quality-filter-control">
              <span>対象上限／ページ</span>
              <select value={limit} onChange={(event) => { setLimit(Number(event.target.value)); resetPaging(); }}>
                <option value={10}>10問</option>
                <option value={20}>20問</option>
                <option value={50}>50問</option>
                <option value={100}>100問</option>
              </select>
            </label>
            <label className="quality-filter-control">
              <span>品質維持の分割単位</span>
              <select value={batchSize} onChange={(event) => { setBatchSize(Number(event.target.value)); setBatchNumber(1); setPreview([]); setResultText(""); }}>
                {QUESTION_QUALITY_BATCH_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>{size}問ずつ{size === 8 ? "（推奨）" : ""}</option>
                ))}
              </select>
            </label>
            <label className="quality-filter-control">
              <span>レビュー重点</span>
              <select value={focus} onChange={(event) => setFocus(event.target.value as QuestionQualityReviewFocus)}>
                {Object.entries(REVIEW_FOCUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="quality-pending-toggle">
            <input type="checkbox" checked={excludePending} onChange={(event) => { setExcludePending(event.target.checked); resetPaging(); }} />
            <span>未確認の品質提案がある問題を除外する（重複提案を防止）</span>
          </label>
        </section>

        <section className="quality-target-panel" aria-labelledby="quality-target-title">
          <h2 id="quality-target-title">2. 対象件数・対象問題を確認</h2>
          <div className="quality-count-grid" aria-label="対象件数">
            <span><strong>{selectionPlan.activeCount}</strong>有効問題</span>
            <span><strong>{selectionPlan.filterMatchedCount}</strong>条件一致</span>
            <span><strong>{selectionPlan.pendingExcludedCount}</strong>重複回避</span>
            <span><strong>{selectionPlan.pageQuestions.length}</strong>現在表示</span>
            <span><strong>{selectedQuestions.length}</strong>選択済み</span>
            <span><strong>{batches.length}</strong>分割数</span>
          </div>
          <p className="quality-range-note">
            条件一致後 {selectionPlan.matchedQuestions.length}問のうち、{selectionPlan.pageQuestions.length > 0 ? selectionPlan.pageStart + 1 : 0}～{selectionPlan.pageEnd}問を表示しています。
          </p>
          <div className="quality-page-actions">
            <button type="button" disabled={!selectionPlan.hasPreviousPage} onClick={() => setOffset(Math.max(0, selectionPlan.pageStart - limit))}>前の{limit}問</button>
            <button type="button" disabled={!selectionPlan.hasNextPage} onClick={() => setOffset(selectionPlan.pageStart + limit)}>次の{limit}問</button>
            <button type="button" disabled={selectionPlan.pageQuestions.length === 0} onClick={() => setSelectedIds(new Set(selectionPlan.pageQuestions.map((item) => item.id)))}>表示分をすべて選択</button>
            <button type="button" disabled={selectedIds.size === 0} onClick={() => setSelectedIds(new Set())}>選択解除</button>
          </div>
          <div className="quality-target-list">
            {selectionPlan.pageQuestions.map((question) => (
              <label key={question.id} className={selectedIds.has(question.id) ? "selected" : ""}>
                <input
                  type="checkbox"
                  checked={selectedIds.has(question.id)}
                  onChange={() => {
                    const next = new Set(selectedIds);
                    if (next.has(question.id)) next.delete(question.id);
                    else next.add(question.id);
                    setSelectedIds(next);
                    setBatchNumber(1);
                    setPreview([]);
                    setResultText("");
                  }}
                />
                <span className="quality-target-main">
                  <strong>{question.id}</strong>
                  <small>{question.category} / {question.subcategory ?? "サブカテゴリなし"}</small>
                  <b>{question.text}</b>
                </span>
                <span className="quality-target-meta">
                  <small>難易度 {question.difficulty}</small>
                  <small>{questionTypeLabel(question)}</small>
                  <small>{question.source?.trim() ? "出典あり" : "出典なし"}</small>
                </span>
              </label>
            ))}
            {selectionPlan.pageQuestions.length === 0 && <div className="empty-state">条件に一致する問題はありません。</div>}
          </div>
        </section>

        <section className="fact-check-section quality-prompt-section">
          <h2>3. 分割ごとに品質プロンプトを発行</h2>
          <div className="quality-batch-toolbar">
            <label>
              <span>現在の分割</span>
              <select value={Math.min(batchNumber, Math.max(1, batches.length))} disabled={batches.length === 0} onChange={(event) => changeBatch(Number(event.target.value))}>
                {batches.map((batch) => (
                  <option key={batch.number} value={batch.number}>分割 {batch.number} / {batches.length}（{batch.questions.length}問）</option>
                ))}
              </select>
            </label>
            <span>{currentBatch ? currentBatch.questions.map((item) => item.id).join("、") : "対象なし"}</span>
          </div>
          <div className="quality-export-actions">
            <button
              className="secondary-button"
              type="button"
              disabled={!currentBatch}
              onClick={() => currentBatch && downloadJson(createQualityInput(currentBatch.questions), `study-quiz-quality-input-batch-${currentBatch.number}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`)}
            >
              現在の分割JSONを出力
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={selectedQuestions.length === 0}
              onClick={() => downloadJson(createQualityInput(selectedQuestions), `study-quiz-quality-input-selected-${new Date().toISOString().replace(/[:.]/g, "-")}.json`)}
            >
              選択全体JSONを出力
            </button>
          </div>
          <textarea rows={18} readOnly value={prompt} aria-label="問題品質確認プロンプト" />
          <button
            className="primary-button"
            type="button"
            disabled={!prompt}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(prompt);
                setError("");
                setMessage(`分割${currentBatch?.number ?? 0}（${currentBatch?.questions.length ?? 0}問）の品質重視プロンプトをコピーしました。`);
              } catch {
                setError("コピーできませんでした。プロンプト欄を選択してコピーしてください。");
              }
            }}
          >
            現在の分割プロンプトをコピー
          </button>
        </section>

        <div className="fact-check-section">
          <h2>4. 現在の分割の提案JSONを入力</h2>
          <p className="quality-range-note">JSONは現在選択している分割の問題IDだけを受け付けます。別の分割結果を取り込む場合は、先に分割を切り替えてください。</p>
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
          <button className="secondary-button" type="button" disabled={!resultText.trim() || !currentBatch} onClick={parse}>
            JSONを検証・プレビュー
          </button>
        </div>

        {preview.length > 0 && (
          <section className="fact-check-findings" aria-label="品質提案プレビュー">
            <h2>5. 登録前プレビュー</h2>
            {preview.map((item) => (
              <article key={item.id} className="finding-needs_correction">
                <div><strong>{item.questionId}</strong><b>{item.kind === "correction" ? "修正" : "補足"}</b></div>
                <p>{item.summary}</p>
                <small>変更項目: {changedFieldLabels(item).join("、")}</small>
                <small>変更前: {item.beforeQuestion.text}</small>
                <small>変更後: {item.proposedQuestion.text}</small>
                <small>変更前正答: {formatCorrectAnswer(item.beforeQuestion)}</small>
                <small>変更後正答: {formatCorrectAnswer(item.proposedQuestion)}</small>
                <small>変更前解説: {item.beforeQuestion.explanation}</small>
                <small>変更後解説: {item.proposedQuestion.explanation}</small>
                <small>根拠: {item.reference || "記載なし"}</small>
              </article>
            ))}
            <button className="primary-button" type="button" onClick={register}>
              未確認の品質提案として登録（{preview.length}件）
            </button>
          </section>
        )}
        {message && <div className="backup-success" role="status">{message}</div>}
        {error && <div className="error-box" role="alert">{error}</div>}
        <button className="secondary-button" type="button" onClick={onOpenReview}>品質提案レビューを開く</button>
        <button className="secondary-button" type="button" onClick={onBack}>前のメニューへ戻る</button>
      </section>
    </main>
  );
}
