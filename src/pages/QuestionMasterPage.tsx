import { useMemo, useState } from "react";
import ConfirmDialog from "../components/ConfirmDialog";
import {
  configuredContentApiBaseUrl,
  ContentPullRequestApiError,
  createContentPullRequest,
  getContentPullRequestStatus,
} from "../services/contentPullRequestApi";
import {
  buildQuestionMasterChanges,
  createContentPullRequestCommand,
} from "../services/questionMasterChangeService";
import {
  applyQuestionMasterMerge,
  fetchQuestionMaster,
  loadQuestionMasterSyncState,
  planQuestionMasterMerge,
  saveQuestionMasterSyncState,
} from "../services/questionMasterService";
import type { Question } from "../types/Question";
import type {
  CreateContentPullRequestCommand,
  CreateContentPullRequestResult,
  QuestionMasterChange,
  QuestionMasterMergePlan,
  QuestionMasterSnapshot,
} from "../types/QuestionMaster";

type Props = {
  questions: Question[];
  onQuestionsChange: (items: Question[]) => boolean;
  onBack: () => void;
};

type PageState =
  | "idle"
  | "loading"
  | "ready"
  | "sending"
  | "success"
  | "error";

const fieldLabels: Record<string, string> = {
  id: "問題ID",
  examScopeId: "試験枠",
  category: "カテゴリ",
  subcategory: "サブカテゴリ",
  text: "問題文",
  questionType: "回答方式",
  choices: "選択肢",
  answerIndex: "正解",
  answerIndices: "複数正解",
  acceptedAnswers: "許容回答",
  explanation: "解説",
  source: "出典",
  tags: "タグ",
  weight: "ウェイト",
  difficulty: "難易度",
  archivedAt: "アーカイブ日時",
};

const operationLabel = (change: QuestionMasterChange): string => {
  if (change.operation === "add") return "新規追加";
  if (change.operation === "archive") return "アーカイブ";
  return "更新";
};

const statusLabel = (state: CreateContentPullRequestResult["state"]): string => {
  if (state === "merged") return "マージ済み";
  if (state === "closed") return "クローズ済み";
  return "作成済み・未マージ";
};

const displayValue = (value: unknown): string => {
  if (value === undefined) return "（なし）";
  if (Array.isArray(value)) return value.join(" / ") || "（空）";
  return String(value);
};

export default function QuestionMasterPage({
  questions,
  onQuestionsChange,
  onBack,
}: Props) {
  const [pageState, setPageState] = useState<PageState>("idle");
  const [snapshot, setSnapshot] = useState<QuestionMasterSnapshot | null>(null);
  const [mergePlan, setMergePlan] = useState<QuestionMasterMergePlan | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState("問題マスターを更新");
  const [body, setBody] = useState(
    "アプリ内で確認した問題マスターの変更です。追加・更新・アーカイブ内容をレビューしてください。",
  );
  const [commitMessage, setCommitMessage] = useState("Update quiz content master");
  const [pendingCommand, setPendingCommand] =
    useState<CreateContentPullRequestCommand | null>(null);
  const [pullRequest, setPullRequest] =
    useState<CreateContentPullRequestResult | null>(null);

  const apiBaseUrl = useMemo(() => {
    try {
      return configuredContentApiBaseUrl();
    } catch {
      return null;
    }
  }, []);

  const changes = useMemo(
    () => (snapshot ? buildQuestionMasterChanges(snapshot, questions) : []),
    [questions, snapshot],
  );
  const counts = useMemo(
    () => ({
      add: changes.filter((change) => change.operation === "add").length,
      update: changes.filter((change) => change.operation === "update").length,
      archive: changes.filter((change) => change.operation === "archive").length,
    }),
    [changes],
  );

  const refreshMaster = async () => {
    setPageState("loading");
    setError("");
    setMessage("");
    try {
      const loadedSnapshot = await fetchQuestionMaster();
      const state = loadQuestionMasterSyncState();
      const plan = planQuestionMasterMerge(questions, loadedSnapshot, state);
      setSnapshot(loadedSnapshot);
      setMergePlan(plan);
      setPageState("ready");
      setMessage(
        `問題マスター ${loadedSnapshot.manifest.contentVersion} を確認しました。`,
      );
      if (state?.lastPullRequest) {
        setPullRequest({
          number: state.lastPullRequest.number,
          url: state.lastPullRequest.url,
          branch: state.lastPullRequest.branch,
          state: state.lastPullRequest.state,
          reused: true,
        });
      }
    } catch (caught) {
      setPageState("error");
      setError(
        caught instanceof Error
          ? caught.message
          : "問題マスターを取得できませんでした。",
      );
    }
  };

  const applySafeUpdates = () => {
    if (!snapshot || !mergePlan) return;
    if (mergePlan.actions.length === 0) {
      saveQuestionMasterSyncState(mergePlan.nextState);
      setMessage("安全に適用できる更新はありません。確認基準だけを更新しました。");
      return;
    }
    const next = applyQuestionMasterMerge(questions, mergePlan);
    if (!onQuestionsChange(next)) {
      setError("問題マスターの更新を端末内へ保存できませんでした。");
      return;
    }
    saveQuestionMasterSyncState(mergePlan.nextState);
    const nextPlan = planQuestionMasterMerge(next, snapshot, mergePlan.nextState);
    setMergePlan(nextPlan);
    setMessage(
      `${mergePlan.actions.length}件の安全な更新を適用しました。競合は上書きしていません。`,
    );
    setError("");
  };

  const prepareSubmission = async () => {
    if (!snapshot) {
      setError("先に最新の問題マスターを確認してください。");
      return;
    }
    if (!apiBaseUrl) {
      setError(
        "Workers APIが未設定です。VITE_QUIZ_CONTENT_API_URLを設定して再ビルドしてください。",
      );
      return;
    }
    try {
      const command = await createContentPullRequestCommand(snapshot, changes, {
        title,
        body,
        commitMessage,
      });
      setPendingCommand(command);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "送信内容を確定できませんでした。");
    }
  };

  const submitPullRequest = async () => {
    if (!pendingCommand || !apiBaseUrl) return;
    const command = pendingCommand;
    setPendingCommand(null);
    setPageState("sending");
    setError("");
    setMessage("Pull Requestを作成しています。画面を閉じずにお待ちください。");
    try {
      const result = await createContentPullRequest(command, apiBaseUrl);
      setPullRequest(result);
      setPageState("success");
      setMessage(
        result.reused
          ? `既存のPull Request #${result.number}を確認しました。`
          : `Pull Request #${result.number}を作成しました。GitHub上で確認・マージしてください。`,
      );
      if (snapshot) {
        const previous = loadQuestionMasterSyncState();
        const baseState = planQuestionMasterMerge(
          questions,
          snapshot,
          previous,
        ).nextState;
        saveQuestionMasterSyncState({
          ...baseState,
          lastPullRequest: {
            number: result.number,
            url: result.url,
            branch: result.branch,
            state: result.state,
            updatedAt: new Date().toISOString(),
          },
        });
      }
    } catch (caught) {
      setPageState("error");
      const action =
        caught instanceof ContentPullRequestApiError && caught.action
          ? ` ${caught.action}`
          : "";
      setError(
        `${caught instanceof Error ? caught.message : "Pull Requestを作成できませんでした。"}${action}`,
      );
      setMessage("端末内の編集内容は保持されています。");
    }
  };

  const refreshPullRequestStatus = async () => {
    if (!pullRequest || !apiBaseUrl) return;
    setPageState("loading");
    setError("");
    try {
      const result = await getContentPullRequestStatus(pullRequest.number, apiBaseUrl);
      setPullRequest(result);
      setPageState("success");
      setMessage(`Pull Request #${result.number}: ${statusLabel(result.state)}`);
      const state = loadQuestionMasterSyncState();
      if (state) {
        saveQuestionMasterSyncState({
          ...state,
          lastPullRequest: {
            number: result.number,
            url: result.url,
            branch: result.branch,
            state: result.state,
            updatedAt: new Date().toISOString(),
          },
        });
      }
    } catch (caught) {
      setPageState("error");
      setError(caught instanceof Error ? caught.message : "状態を確認できませんでした。");
    }
  };

  return (
    <main className="app-shell">
      <section className="home-card question-master-card">
        <p className="eyebrow">CONTENT GOVERNANCE</p>
        <h1>問題マスター・GitHub連携</h1>
        <p>
          端末内の問題編集は従来どおり先に保存されます。GitHubへは、確認した差分だけをWorkers経由で送り、専用ブランチとPull Requestを作成します。
        </p>

        <section className="question-master-status" aria-label="接続状態">
          <div><span>問題マスター</span><strong>{snapshot?.manifest.contentVersion ?? "未確認"}</strong></div>
          <div><span>Workers API</span><strong>{apiBaseUrl ? apiBaseUrl.origin : "未設定"}</strong></div>
          <div><span>対象リポジトリ／ベースブランチ</span><strong>Workers側の許可設定で固定</strong></div>
        </section>

        {error && <div className="error-box" role="alert">{error}</div>}
        {message && <div className="backup-success" role="status">{message}</div>}

        <div className="question-master-actions">
          <button
            className="primary-button"
            type="button"
            disabled={pageState === "loading" || pageState === "sending"}
            onClick={() => void refreshMaster()}
          >
            最新マスターと差分を確認
          </button>
          <button className="secondary-button" type="button" onClick={onBack}>
            前のメニューへ戻る
          </button>
        </div>

        {mergePlan && (
          <section className="master-sync-panel" aria-labelledby="master-sync-title">
            <h2 id="master-sync-title">最新版の端末適用</h2>
            <div className="master-count-grid">
              <span><strong>{mergePlan.actions.length}</strong>安全に適用可能</span>
              <span><strong>{mergePlan.conflicts.length}</strong>競合・保留</span>
              <span><strong>{mergePlan.unchangedCount}</strong>維持</span>
            </div>
            {mergePlan.conflicts.length > 0 && (
              <div className="master-conflict-list" role="alert">
                <strong>端末編集を保護した競合</strong>
                {mergePlan.conflicts.map((conflict) => (
                  <span key={conflict.questionId}>
                    {conflict.questionId}: {conflict.reason}
                  </span>
                ))}
              </div>
            )}
            <button
              className="secondary-button"
              type="button"
              onClick={applySafeUpdates}
            >
              安全な更新だけを端末へ適用
            </button>
          </section>
        )}

        {snapshot && (
          <section className="master-change-panel" aria-labelledby="master-change-title">
            <h2 id="master-change-title">GitHub送信前の変更確認</h2>
            <div className="master-count-grid" aria-label="変更件数">
              <span><strong>{changes.length}</strong>合計</span>
              <span><strong>{counts.add}</strong>新規</span>
              <span><strong>{counts.update}</strong>更新</span>
              <span><strong>{counts.archive}</strong>アーカイブ</span>
            </div>
            <div className="master-change-list">
              {changes.map((change) => (
                <details key={change.questionId} className="master-change-item">
                  <summary>
                    <b>{operationLabel(change)}</b>
                    <span>{change.questionId}</span>
                    <small>{change.changedFields.map((field) => fieldLabels[field] ?? field).join("、")}</small>
                  </summary>
                  {change.changedFields.map((field) => (
                    <div className="master-field-diff" key={field}>
                      <strong>{fieldLabels[field] ?? field}</strong>
                      <div><span>変更前</span><p>{displayValue((change.before as unknown as Record<string, unknown> | undefined)?.[field])}</p></div>
                      <div><span>変更後</span><p>{displayValue((change.after as unknown as Record<string, unknown>)[field])}</p></div>
                    </div>
                  ))}
                </details>
              ))}
              {changes.length === 0 && <div className="empty-state">GitHubへ送信する変更はありません。</div>}
            </div>

            <div className="form-grid master-pr-form">
              <label className="form-item">
                <span>Pull Requestタイトル</span>
                <input maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} />
              </label>
              <label className="form-item">
                <span>コミットメッセージ</span>
                <input maxLength={500} value={commitMessage} onChange={(event) => setCommitMessage(event.target.value)} />
              </label>
              <label className="form-item">
                <span>Pull Request説明</span>
                <textarea maxLength={20_000} value={body} onChange={(event) => setBody(event.target.value)} />
              </label>
            </div>
            <button
              className="primary-button"
              type="button"
              disabled={changes.length === 0 || pageState === "sending"}
              onClick={() => void prepareSubmission()}
            >
              送信内容を確定してPull Requestを作成
            </button>
            <p className="master-security-note">
              この操作はメインブランチへ直接コミットせず、自動マージもしません。GitHubの秘密鍵・トークンはブラウザーへ保存しません。
            </p>
          </section>
        )}

        {pullRequest && (
          <section className="master-pr-result" aria-label="Pull Request結果">
            <strong>Pull Request #{pullRequest.number}</strong>
            <span>{statusLabel(pullRequest.state)}</span>
            <small>ブランチ: {pullRequest.branch}</small>
            <a href={pullRequest.url} target="_blank" rel="noreferrer">GitHubでPull Requestを開く</a>
            <button type="button" onClick={() => void refreshPullRequestStatus()}>
              GitHub上の状態を再確認
            </button>
          </section>
        )}
      </section>
      <ConfirmDialog
        open={pendingCommand !== null}
        title="GitHubへ変更を送信しますか？"
        description={
          pendingCommand
            ? `${pendingCommand.changes.length}件の変更から専用ブランチとPull Requestを作成します。メインブランチへの直接反映・自動マージは行いません。`
            : ""
        }
        confirmLabel="Pull Requestを作成"
        onConfirm={() => void submitPullRequest()}
        onCancel={() => setPendingCommand(null)}
      />
    </main>
  );
}
