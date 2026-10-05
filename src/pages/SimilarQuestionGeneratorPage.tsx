import { useMemo, useState } from "react";
import {
  buildSimilarQuestionPrompt,
  parseSimilarQuestionDraft,
  validateSimilarQuestion,
} from "../services/similarQuestionService";
import type { Question } from "../types/Question";

type Props = {
  questions: Question[];
  onRegister: (question: Question) => boolean;
  onBack: () => void;
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export default function SimilarQuestionGeneratorPage({
  questions,
  onRegister,
  onBack,
}: Props) {
  const [baseQuestionId, setBaseQuestionId] = useState(questions[0]?.id ?? "");
  const [responseJson, setResponseJson] = useState("");
  const [draft, setDraft] = useState<Question | null>(null);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const baseQuestion =
    questions.find((question) => question.id === baseQuestionId) ?? questions[0];
  const prompt = useMemo(
    () => (baseQuestion ? buildSimilarQuestionPrompt(baseQuestion) : ""),
    [baseQuestion],
  );

  const resetDraft = () => {
    setDraft(null);
    setReviewConfirmed(false);
    setMessage("");
    setError("");
  };

  const copyPrompt = async () => {
    setMessage("");
    setError("");
    try {
      await navigator.clipboard.writeText(prompt);
      setMessage("プロンプトをコピーしました。利用するAIへ貼り付けてください。");
    } catch {
      setError(
        "コピーできませんでした。プレビュー欄を選択してコピーしてください。",
      );
    }
  };

  const importDraft = () => {
    setMessage("");
    setError("");
    if (!baseQuestion) {
      setError("元問題を選択してください。");
      return;
    }
    try {
      setDraft(
        parseSimilarQuestionDraft(responseJson, baseQuestion, questions),
      );
      setReviewConfirmed(false);
      setMessage("類似問題案を読み込みました。全項目を確認・編集してください。");
    } catch (loadError) {
      setDraft(null);
      setReviewConfirmed(false);
      setError(errorMessage(loadError));
    }
  };

  const register = () => {
    setMessage("");
    setError("");
    if (!baseQuestion || !draft) return;
    try {
      const normalized = validateSimilarQuestion(
        draft,
        baseQuestion,
        questions,
      );
      if (!reviewConfirmed) {
        setError("内容確認チェックを付けてから登録してください。");
        return;
      }
      if (!onRegister(normalized)) {
        setError("保存できませんでした。端末の空き容量を確認してください。");
        return;
      }
      setResponseJson("");
      setDraft(null);
      setReviewConfirmed(false);
      setMessage(`類似問題 ${normalized.id} を登録しました。`);
    } catch (registerError) {
      setError(errorMessage(registerError));
    }
  };

  const changeChoice = (index: number, value: string) => {
    if (!draft) return;
    const choices = [...draft.choices];
    choices[index] = value;
    setDraft({ ...draft, choices });
    setReviewConfirmed(false);
  };

  const removeChoice = (index: number) => {
    if (!draft || draft.choices.length <= 2) return;
    const choices = draft.choices.filter((_, itemIndex) => itemIndex !== index);
    const answerIndex =
      draft.answerIndex === index
        ? 0
        : draft.answerIndex > index
          ? draft.answerIndex - 1
          : draft.answerIndex;
    setDraft({ ...draft, choices, answerIndex });
    setReviewConfirmed(false);
  };

  return (
    <main className="app-shell">
      <section className="home-card similar-question-card">
        <p className="eyebrow">SIMILAR QUESTION</p>
        <h1>類似問題生成</h1>
        <p className="planning-note">
          外部AIへ自動送信しません。元問題の情報を含むプロンプトをコピーし、AIのJSON回答を貼り付け、確認・編集後にのみ登録します。
        </p>

        {questions.length === 0 ? (
          <div className="backup-error" role="alert">
            元にする問題がありません。先に問題を登録してください。
          </div>
        ) : (
          <>
            <section className="similar-question-step" aria-labelledby="similar-step-1">
              <h2 id="similar-step-1">1. 元問題と送信内容を確認</h2>
              <label className="form-item">
                <span>元問題</span>
                <select
                  value={baseQuestion?.id ?? ""}
                  onChange={(event) => {
                    setBaseQuestionId(event.target.value);
                    resetDraft();
                  }}
                >
                  {questions.map((question) => (
                    <option key={question.id} value={question.id}>
                      {question.id} / {question.category} / {question.text}
                    </option>
                  ))}
                </select>
              </label>
              <textarea
                className="prompt-preview"
                aria-label="類似問題生成プロンプト"
                rows={14}
                readOnly
                value={prompt}
              />
              <button
                className="primary-button"
                type="button"
                disabled={!prompt}
                onClick={() => void copyPrompt()}
              >
                プロンプトをコピー
              </button>
            </section>

            <section className="similar-question-step" aria-labelledby="similar-step-2">
              <h2 id="similar-step-2">2. AIのJSON回答を読み込む</h2>
              <label className="form-item">
                <span>類似問題案JSON</span>
                <textarea
                  rows={12}
                  value={responseJson}
                  placeholder='{"category":"...","text":"...","choices":["...","..."],"answerNumber":1,"explanation":"...","weight":1,"difficulty":1}'
                  onChange={(event) => {
                    setResponseJson(event.target.value);
                    resetDraft();
                  }}
                />
              </label>
              <button
                className="secondary-button"
                type="button"
                disabled={!responseJson.trim()}
                onClick={importDraft}
              >
                JSONを検証して下書きへ反映
              </button>
            </section>
          </>
        )}

        {draft && baseQuestion && (
          <section className="similar-question-step" aria-labelledby="similar-step-3">
            <h2 id="similar-step-3">3. 内容を編集・確認して登録</h2>
            <div className="similar-question-grid">
              <label className="form-item">
                <span>問題ID</span>
                <input value={draft.id} readOnly />
              </label>
              <label className="form-item">
                <span>カテゴリ</span>
                <input
                  maxLength={200}
                  value={draft.category}
                  onChange={(event) => {
                    setDraft({ ...draft, category: event.target.value });
                    setReviewConfirmed(false);
                  }}
                />
              </label>
              <label className="form-item">
                <span>サブカテゴリ</span>
                <input
                  maxLength={500}
                  value={draft.subcategory ?? ""}
                  onChange={(event) => {
                    setDraft({ ...draft, subcategory: event.target.value });
                    setReviewConfirmed(false);
                  }}
                />
              </label>
              <label className="form-item similar-question-wide">
                <span>問題文</span>
                <textarea
                  rows={5}
                  maxLength={20_000}
                  value={draft.text}
                  onChange={(event) => {
                    setDraft({ ...draft, text: event.target.value });
                    setReviewConfirmed(false);
                  }}
                />
              </label>
            </div>

            <fieldset className="similar-question-choices">
              <legend>選択肢と正解</legend>
              {draft.choices.map((choice, index) => (
                <div className="similar-question-choice" key={`${index}-${choice}`}>
                  <label>
                    <input
                      type="radio"
                      name="similar-question-answer"
                      checked={draft.answerIndex === index}
                      onChange={() => {
                        setDraft({ ...draft, answerIndex: index });
                        setReviewConfirmed(false);
                      }}
                    />
                    <span>正解 {index + 1}</span>
                  </label>
                  <input
                    aria-label={`選択肢${index + 1}`}
                    value={choice}
                    onChange={(event) => changeChoice(index, event.target.value)}
                  />
                  <button
                    className="inline-link-button"
                    type="button"
                    disabled={draft.choices.length <= 2}
                    onClick={() => removeChoice(index)}
                  >
                    削除
                  </button>
                </div>
              ))}
              <button
                className="secondary-button"
                type="button"
                disabled={draft.choices.length >= 8}
                onClick={() => {
                  setDraft({ ...draft, choices: [...draft.choices, ""] });
                  setReviewConfirmed(false);
                }}
              >
                選択肢を追加
              </button>
            </fieldset>

            <label className="form-item">
              <span>解説</span>
              <textarea
                rows={6}
                maxLength={20_000}
                value={draft.explanation}
                onChange={(event) => {
                  setDraft({ ...draft, explanation: event.target.value });
                  setReviewConfirmed(false);
                }}
              />
            </label>
            <label className="form-item">
              <span>出典</span>
              <input
                maxLength={2_000}
                value={draft.source ?? ""}
                onChange={(event) => {
                  setDraft({ ...draft, source: event.target.value });
                  setReviewConfirmed(false);
                }}
              />
            </label>
            <label className="form-item">
              <span>タグ（カンマ区切り）</span>
              <input
                value={(draft.tags ?? []).join(", ")}
                onChange={(event) => {
                  setDraft({
                    ...draft,
                    tags: event.target.value
                      .split(",")
                      .map((tag: string) => tag.trim())
                      .filter(Boolean),
                  });
                  setReviewConfirmed(false);
                }}
              />
            </label>
            <div className="similar-question-grid">
              <label className="form-item">
                <span>重要度（1～5）</span>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={draft.weight}
                  onChange={(event) => {
                    setDraft({ ...draft, weight: Number(event.target.value) });
                    setReviewConfirmed(false);
                  }}
                />
              </label>
              <label className="form-item">
                <span>難易度（1～5）</span>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={draft.difficulty}
                  onChange={(event) => {
                    setDraft({
                      ...draft,
                      difficulty: Number(event.target.value),
                    });
                    setReviewConfirmed(false);
                  }}
                />
              </label>
            </div>

            <label className="similar-question-confirm">
              <input
                type="checkbox"
                checked={reviewConfirmed}
                onChange={(event) => setReviewConfirmed(event.target.checked)}
              />
              <span>
                問題文、選択肢、正解、解説、出典を確認しました。元問題は変更されないことを理解しています。
              </span>
            </label>
            <button
              className="primary-button"
              type="button"
              disabled={!reviewConfirmed}
              onClick={register}
            >
              確認済みの類似問題を登録
            </button>
          </section>
        )}

        {message && (
          <div className="backup-success" role="status" aria-live="polite">
            {message}
          </div>
        )}
        {error && (
          <div className="backup-error" role="alert" aria-live="assertive">
            {error}
          </div>
        )}
        <button className="secondary-button" type="button" onClick={onBack}>
          問題・教材管理へ戻る
        </button>
      </section>
    </main>
  );
}
