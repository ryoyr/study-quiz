import { useMemo, useState } from "react";
import ConfirmDialog from "../components/ConfirmDialog";
import {
  applyD1ChangesWithAccessSession,
  configuredContentApiBaseUrl,
  D1ContentApiError,
} from "../services/d1ContentApi";
import {
  buildQuestionMasterChanges,
  countLocalOnlyQuestions,
  createApplyD1ChangesCommand,
} from "../services/questionMasterChangeService";
import {
  applyQuestionMasterMerge,
  fetchQuestionMasterWithSource,
  loadQuestionMasterSyncState,
  planQuestionMasterMerge,
  saveQuestionMasterSyncState,
} from "../services/questionMasterService";
import {
  appendQuestionRevision,
  createQuestionRevision,
  loadQuestionRevisions,
  saveQuestionRevisions,
} from "../services/questionRevisionService";
import type { Question } from "../types/Question";
import type {
  ApplyD1ChangesCommand,
  ApplyD1ChangesResult,
  LoadedQuestionMaster,
  QuestionMasterChange,
  QuestionMasterMergePlan,
  QuestionMasterSnapshot,
} from "../types/QuestionMaster";

type Props = {
  questions: Question[];
  onQuestionsChange: (items: Question[]) => boolean;
  onBack: () => void;
};

type PageState = "idle" | "loading" | "ready" | "sending" | "success" | "error";

const fieldLabels: Record<string, string> = {
  id: "問題ID", examScopeId: "試験枠", category: "カテゴリ", subcategory: "サブカテゴリ",
  text: "問題文", questionType: "回答方式", choices: "選択肢", answerIndex: "正解",
  answerIndices: "複数正解", acceptedAnswers: "許容回答", explanation: "解説",
  source: "出典", tags: "タグ", weight: "ウェイト", difficulty: "難易度",
  archivedAt: "アーカイブ日時",
};

const operationLabel = (change: QuestionMasterChange): string =>
  change.operation === "add" ? "新規追加" : change.operation === "archive" ? "アーカイブ" : "更新";

const displayValue = (value: unknown): string =>
  value === undefined ? "（なし）" : Array.isArray(value) ? value.join(" / ") || "（空）" : String(value);

const sourceLabel = (loaded: LoadedQuestionMaster | null): string => {
  if (!loaded) return "未確認";
  if (loaded.source === "d1") return "Cloudflare D1";
  if (loaded.source === "indexeddb-cache") return "端末IndexedDB cache";
  return "同梱offline snapshot";
};

export default function QuestionMasterPage({ questions, onQuestionsChange, onBack }: Props) {
  const [pageState, setPageState] = useState<PageState>("idle");
  const [loadedMaster, setLoadedMaster] = useState<LoadedQuestionMaster | null>(null);
  const [snapshot, setSnapshot] = useState<QuestionMasterSnapshot | null>(null);
  const [mergePlan, setMergePlan] = useState<QuestionMasterMergePlan | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [changeMessage, setChangeMessage] = useState("確認済みの問題・解説をD1共有マスターへ反映");
  const [pendingCommand, setPendingCommand] = useState<ApplyD1ChangesCommand | null>(null);
  const [writeResult, setWriteResult] = useState<ApplyD1ChangesResult | null>(null);

  const apiBaseUrl = useMemo(() => {
    try { return configuredContentApiBaseUrl(); } catch { return null; }
  }, []);
  const changes = useMemo(
    () => (snapshot ? buildQuestionMasterChanges(snapshot, questions) : []),
    [questions, snapshot],
  );
  const localOnlyCount = useMemo(() => countLocalOnlyQuestions(questions), [questions]);
  const counts = useMemo(() => ({
    add: changes.filter((item) => item.operation === "add").length,
    update: changes.filter((item) => item.operation === "update").length,
    archive: changes.filter((item) => item.operation === "archive").length,
  }), [changes]);

  const refreshMaster = async () => {
    setPageState("loading");
    setError("");
    setMessage("");
    try {
      const loaded = await fetchQuestionMasterWithSource();
      const plan = planQuestionMasterMerge(
        questions,
        loaded.snapshot,
        loadQuestionMasterSyncState(),
      );
      setLoadedMaster(loaded);
      setSnapshot(loaded.snapshot);
      setMergePlan(plan);
      setPageState("ready");
      setMessage(
        `問題マスター ${loaded.snapshot.manifest.contentVersion} を${sourceLabel(loaded)}から確認しました。${loaded.warning ?? ""}`,
      );
    } catch (caught) {
      setPageState("error");
      setError(caught instanceof Error ? caught.message : "問題マスターを取得できませんでした。");
    }
  };

  const applySafeUpdates = () => {
    if (!snapshot || !mergePlan) return;
    if (mergePlan.actions.length === 0) {
      saveQuestionMasterSyncState(mergePlan.nextState);
      setMessage("安全に適用できる更新はありません。同期基準だけを更新しました。");
      return;
    }
    const next = applyQuestionMasterMerge(questions, mergePlan);
    if (!onQuestionsChange(next)) {
      setError("問題マスターの更新を端末内へ保存できませんでした。");
      return;
    }
    let revisionWarning = "";
    try {
      let revisions = loadQuestionRevisions();
      for (const action of mergePlan.actions) {
        revisions = appendQuestionRevision(revisions, createQuestionRevision({
          before: action.before ?? null,
          after: action.after,
          source: "master-sync",
          summary: action.kind === "add"
            ? "D1問題マスターから追加"
            : action.kind === "archive"
              ? "D1削除を端末アーカイブとして反映"
              : "D1問題マスター更新を反映",
        }));
      }
      saveQuestionRevisions(revisions);
    } catch (caught) {
      revisionWarning = ` 改訂履歴は保存できませんでした: ${caught instanceof Error ? caught.message : String(caught)}`;
    }
    saveQuestionMasterSyncState(mergePlan.nextState);
    setMergePlan(planQuestionMasterMerge(next, snapshot, mergePlan.nextState));
    setMessage(`${mergePlan.actions.length}件の安全な更新を端末へ適用しました。競合は上書きしていません。${revisionWarning}`);
    setError("");
  };

  const prepareSubmission = async () => {
    if (!snapshot) return setError("先にD1問題マスターを確認してください。");
    if (!apiBaseUrl) return setError("D1 Worker APIが未設定です。VITE_QUIZ_CONTENT_API_URLを設定してください。");
    try {
      setPendingCommand(await createApplyD1ChangesCommand(snapshot, changes, changeMessage));
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "D1送信内容を確定できませんでした。");
    }
  };

  const submitD1Changes = async () => {
    if (!pendingCommand || !apiBaseUrl) return;
    const command = pendingCommand;
    setPendingCommand(null);
    setPageState("sending");
    setError("");
    setMessage("Cloudflare Access認証後、D1へ変更を反映しています。");
    try {
      const result = await applyD1ChangesWithAccessSession(command, apiBaseUrl);
      setWriteResult(result);
      const reloaded = await fetchQuestionMasterWithSource();
      const baseState = planQuestionMasterMerge(
        questions,
        reloaded.snapshot,
        loadQuestionMasterSyncState(),
      ).nextState;
      saveQuestionMasterSyncState({
        ...baseState,
        lastD1Write: {
          contentVersion: result.contentVersion,
          appliedCount: result.appliedCount,
          updatedAt: result.updatedAt,
        },
      });
      setLoadedMaster(reloaded);
      setSnapshot(reloaded.snapshot);
      setMergePlan(planQuestionMasterMerge(questions, reloaded.snapshot, baseState));
      setPageState("success");
      setMessage(
        result.reused
          ? `同じ送信は既に反映済みです。D1版 ${result.contentVersion} を確認しました。`
          : `${result.appliedCount}件をD1へ反映しました。D1版 ${result.contentVersion}。`,
      );
    } catch (caught) {
      setPageState("error");
      const action = caught instanceof D1ContentApiError && caught.action ? ` ${caught.action}` : "";
      setError(`${caught instanceof Error ? caught.message : "D1へ反映できませんでした。"}${action}`);
      setMessage("端末内の問題・履歴は変更せず保持しています。");
    }
  };

  return (
    <main className="app-shell">
      <section className="home-card question-master-card">
        <p className="eyebrow">D1 CONTENT GOVERNANCE</p>
        <h1>問題マスター・Cloudflare D1連携</h1>
        <p>
          D1を共有問題・解説の正本として取得し、端末編集を保護して安全な更新だけを適用します。
          「この端末のみ」の問題は差分作成時に除外され、Worker側でも拒否されます。
        </p>

        <section className="question-master-status" aria-label="接続状態">
          <div><span>問題マスター版</span><strong>{snapshot?.manifest.contentVersion ?? "未確認"}</strong></div>
          <div><span>取得元</span><strong>{sourceLabel(loadedMaster)}</strong></div>
          <div><span>D1 Worker API</span><strong>{apiBaseUrl?.origin ?? "未設定"}</strong></div>
          <div><span>ローカル専用</span><strong>{localOnlyCount}件（送信対象外）</strong></div>
        </section>

        {error && <div className="error-box" role="alert">{error}</div>}
        {message && <div className="backup-success" role="status">{message}</div>}

        <div className="question-master-actions">
          <button className="primary-button" type="button" disabled={pageState === "loading" || pageState === "sending"} onClick={() => void refreshMaster()}>
            D1最新版と差分を確認
          </button>
          <button className="secondary-button" type="button" onClick={onBack}>前のメニューへ戻る</button>
        </div>

        {mergePlan && (
          <section className="master-sync-panel" aria-labelledby="master-sync-title">
            <h2 id="master-sync-title">D1最新版の端末適用</h2>
            <div className="master-count-grid">
              <span><strong>{mergePlan.actions.length}</strong>安全に適用可能</span>
              <span><strong>{mergePlan.conflicts.length}</strong>競合・保留</span>
              <span><strong>{mergePlan.unchangedCount}</strong>維持</span>
            </div>
            {mergePlan.conflicts.length > 0 && (
              <div className="master-conflict-list" role="alert">
                <strong>端末編集を保護した競合</strong>
                {mergePlan.conflicts.map((item) => <span key={item.questionId}>{item.questionId}: {item.reason}</span>)}
              </div>
            )}
            <button className="secondary-button" type="button" onClick={applySafeUpdates}>安全な更新だけを端末へ適用</button>
          </section>
        )}

        {snapshot && (
          <section className="master-change-panel" aria-labelledby="master-change-title">
            <h2 id="master-change-title">D1反映前の共有変更確認</h2>
            <p className="planning-note">ローカル専用 {localOnlyCount}件はこの一覧と送信payloadから除外済みです。</p>
            <div className="master-count-grid" aria-label="変更件数">
              <span><strong>{changes.length}</strong>合計</span>
              <span><strong>{counts.add}</strong>新規</span>
              <span><strong>{counts.update}</strong>更新</span>
              <span><strong>{counts.archive}</strong>アーカイブ</span>
            </div>
            <div className="master-change-list">
              {changes.map((change) => (
                <details key={change.questionId} className="master-change-item">
                  <summary><b>{operationLabel(change)}</b><span>{change.questionId}</span><small>{change.changedFields.map((field) => fieldLabels[field] ?? field).join("、")}</small></summary>
                  {change.changedFields.map((field) => (
                    <div className="master-field-diff" key={field}>
                      <strong>{fieldLabels[field] ?? field}</strong>
                      <div><span>変更前</span><p>{displayValue((change.before as unknown as Record<string, unknown> | undefined)?.[field])}</p></div>
                      <div><span>変更後</span><p>{displayValue((change.after as unknown as Record<string, unknown>)[field])}</p></div>
                    </div>
                  ))}
                </details>
              ))}
              {changes.length === 0 && <div className="empty-state">D1へ反映する共有変更はありません。</div>}
            </div>
            <label className="form-item">
              <span>変更理由（監査ログへ保存）</span>
              <textarea maxLength={2_000} value={changeMessage} onChange={(event) => setChangeMessage(event.target.value)} />
            </label>
            <button className="primary-button" type="button" disabled={changes.length === 0 || pageState === "sending"} onClick={() => void prepareSubmission()}>
              送信内容を確定してD1へ反映
            </button>
            <p className="master-security-note">
              書込みはCloudflare Access認証popupから同一オリジンで実行します。Access JWT、許可メール、競合fingerprint、冪等キーをWorkerで再検証し、学習履歴・メモ・ローカル専用問題は送信しません。
            </p>
          </section>
        )}

        {writeResult && (
          <section className="master-pr-result" aria-label="D1反映結果">
            <strong>D1 content version {writeResult.contentVersion}</strong>
            <span>{writeResult.appliedCount}件反映</span>
            <small>{new Date(writeResult.updatedAt).toLocaleString("ja-JP")}</small>
          </section>
        )}
      </section>
      <ConfirmDialog
        open={pendingCommand !== null}
        title="共有問題をD1へ反映しますか？"
        description={pendingCommand ? `${pendingCommand.changes.length}件を共有マスターへ反映します。ローカル専用問題と個人データは含みません。` : ""}
        confirmLabel="D1へ反映"
        onConfirm={() => void submitD1Changes()}
        onCancel={() => setPendingCommand(null)}
      />
    </main>
  );
}
