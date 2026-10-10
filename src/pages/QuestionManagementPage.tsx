import { useEffect, useMemo, useState } from "react";
import type { Question } from "../types/Question";
import type { QuestionState } from "../types/QuestionState";
import { getMasteryLabel } from "../services/questionStateService";
import { LPIC101_EXAM_SCOPE_ID, type ExamScope } from "../types/ExamScope";
import ConfirmDialog from "../components/ConfirmDialog";
import {
  QUESTION_LIMITS,
  questionValidationErrors,
} from "../services/questionValidation";

type Props = {
  questions: Question[];
  questionStates: QuestionState[];
  examScopes: ExamScope[];
  initialQuestionId?: string;
  onInitialEditHandled?: () => void;
  onChange: (items: Question[]) => boolean;
  onImport: () => void;
  onBack: () => void;
};

type WeightFilter = "ALL" | "HIGH" | "STANDARD";
type ArchiveFilter = "ACTIVE" | "ARCHIVED" | "ALL";

const emptyQuestion = (): Question => ({
  id: "",
  examScopeId: LPIC101_EXAM_SCOPE_ID,
  category: "",
  subcategory: "",
  text: "",
  questionType: "single",
  choices: ["", "", "", ""],
  answerIndex: 0,
  answerIndices: [0],
  acceptedAnswers: [],
  explanation: "",
  source: "",
  tags: [],
  weight: 1,
  difficulty: 1,
});

const parseTags = (value: string): string[] => [
  ...new Set(
    value
      .split(/[,、]/)
      .map((tag) => tag.trim())
      .filter(Boolean),
  ),
];

export default function QuestionManagementPage({
  questions,
  questionStates,
  examScopes,
  initialQuestionId = "",
  onInitialEditHandled,
  onChange,
  onImport,
  onBack,
}: Props) {
  const [search, setSearch] = useState("");
  const [examScope, setExamScope] = useState("ALL");
  const [category, setCategory] = useState("ALL");
  const [tag, setTag] = useState("ALL");
  const [weight, setWeight] = useState<WeightFilter>("ALL");
  const [archive, setArchive] = useState<ArchiveFilter>("ACTIVE");
  const [editing, setEditing] = useState<Question | null>(null);
  const [originalId, setOriginalId] = useState("");
  const [tagText, setTagText] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pendingArchive, setPendingArchive] = useState<Question | null>(null);

  const categories = useMemo(
    () => [
      "ALL",
      ...new Set(
        questions
          .filter((question) => examScope === "ALL" || question.examScopeId === examScope)
          .map((question) => question.category),
      ),
    ],
    [examScope, questions],
  );
  const tags = useMemo(
    () => [
      "ALL",
      ...new Set(questions.flatMap((question) => question.tags ?? [])),
    ],
    [questions],
  );
  const filtered = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("ja");
    return questions.filter((question) => {
      const searchable = [
        question.id,
        question.category,
        question.subcategory ?? "",
        question.text,
        question.explanation,
        question.source ?? "",
        ...(question.tags ?? []),
      ]
        .join(" ")
        .toLocaleLowerCase("ja");
      const matchesWeight =
        weight === "ALL" ||
        (weight === "HIGH" ? question.weight >= 3 : question.weight < 3);
      const matchesArchive =
        archive === "ALL" ||
        (archive === "ARCHIVED"
          ? Boolean(question.archivedAt)
          : !question.archivedAt);
      return (
        (examScope === "ALL" || question.examScopeId === examScope) &&
        (category === "ALL" || question.category === category) &&
        (tag === "ALL" || question.tags?.includes(tag)) &&
        matchesWeight &&
        matchesArchive &&
        (!keyword || searchable.includes(keyword))
      );
    });
  }, [archive, category, examScope, questions, search, tag, weight]);

  const startNew = () => {
    setOriginalId("");
    setEditing({ ...emptyQuestion(), examScopeId: examScopes.find((item) => item.active)?.id ?? LPIC101_EXAM_SCOPE_ID });
    setTagText("");
    setError("");
    setMessage("");
  };
  const startEdit = (question: Question) => {
    setOriginalId(question.id);
    setEditing({
      ...question,
      choices: [...question.choices],
      tags: [...(question.tags ?? [])],
    });
    setTagText((question.tags ?? []).join(", "));
    setError("");
    setMessage("");
  };

  useEffect(() => {
    if (!initialQuestionId) return;
    const target = questions.find(
      (question) => question.id === initialQuestionId,
    );
    if (target) startEdit(target);
    onInitialEditHandled?.();
  }, [initialQuestionId, onInitialEditHandled, questions]);

  const save = () => {
    if (!editing) return;
    const id = editing.id.trim();
    const questionType = editing.questionType ?? "single";
    const choices = questionType === "text"
      ? []
      : editing.choices.map((choice) => choice.trim());
    const acceptedAnswers = [
      ...new Set((editing.acceptedAnswers ?? []).map((answer) => answer.trim()).filter(Boolean)),
    ];
    const answerIndices = questionType === "multiple"
      ? [...new Set(editing.answerIndices ?? [])].sort((left, right) => left - right)
      : undefined;
    const answerIndex = questionType === "multiple"
      ? (answerIndices?.[0] ?? 0)
      : questionType === "single"
        ? editing.answerIndex
        : 0;
    const tags = parseTags(tagText);
    if (!examScopes.some((item) => item.id === editing.examScopeId && item.active)) {
      setError("利用可能な試験枠を指定してください。");
      return;
    }
    if (
      questions.some(
        (question) => question.id === id && question.id !== originalId,
      )
    ) {
      setError("同じ問題IDが既に存在します。");
      return;
    }
    const next: Question = {
      ...editing,
      id,
      examScopeId: editing.examScopeId.trim(),
      category: editing.category.trim(),
      subcategory: editing.subcategory?.trim() || undefined,
      text: editing.text.trim(),
      questionType,
      choices,
      answerIndex,
      answerIndices,
      acceptedAnswers: questionType === "text" ? acceptedAnswers : undefined,
      explanation: editing.explanation.trim(),
      source: editing.source?.trim() || undefined,
      tags,
    };
    const validationErrors = questionValidationErrors(next);
    if (validationErrors.length > 0) {
      setError(validationErrors[0]);
      return;
    }
    const saved = onChange(
      originalId
        ? questions.map((question) =>
            question.id === originalId ? next : question,
          )
        : [...questions, next],
    );
    if (!saved) {
      setError(
        "端末内へ保存できませんでした。空き容量を確認して再試行してください。",
      );
      return;
    }
    setEditing(null);
  };

  const archiveQuestion = () => {
    if (!pendingArchive) return;
    const saved = onChange(
      questions.map((question) =>
        question.id === pendingArchive.id
          ? { ...question, archivedAt: new Date().toISOString() }
          : question,
      ),
    );
    if (!saved) {
      setError("アーカイブ結果を保存できませんでした。端末の空き容量を確認してください。");
    } else {
      setError("");
      setMessage(`問題 ${pendingArchive.id} をアーカイブしました。`);
    }
    setPendingArchive(null);
  };
  const restoreQuestion = (id: string) => {
    const saved = onChange(
      questions.map((question) => {
        if (question.id !== id) return question;
        const { archivedAt: _archivedAt, ...activeQuestion } = question;
        return activeQuestion;
      }),
    );
    if (!saved) {
      setError("復元結果を保存できませんでした。端末の空き容量を確認してください。");
      return;
    }
    setError("");
    setMessage(`問題 ${id} を利用中へ戻しました。`);
  };

  if (editing) {
    return (
      <main className="app-shell">
        <section className="home-card question-admin-card">
          <h1>{originalId ? "問題編集" : "問題登録"}</h1>
          <div className="form-grid">
            <label className="form-item">
              <span>問題ID</span>
              <input
                maxLength={QUESTION_LIMITS.id}
                value={editing.id}
                onChange={(event) =>
                  setEditing({ ...editing, id: event.target.value })
                }
              />
            </label>
            <label className="form-item">
              <span>試験枠</span>
              <select value={editing.examScopeId} onChange={(event) => setEditing({ ...editing, examScopeId: event.target.value })}>
                {examScopes.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name} ({item.examCode})</option>)}
              </select>
            </label>
            <label className="form-item">
              <span>カテゴリ</span>
              <input
                maxLength={QUESTION_LIMITS.shortText}
                value={editing.category}
                onChange={(event) =>
                  setEditing({ ...editing, category: event.target.value })
                }
              />
            </label>
            <label className="form-item">
              <span>サブカテゴリ（任意）</span>
              <input
                maxLength={QUESTION_LIMITS.shortText}
                value={editing.subcategory ?? ""}
                onChange={(event) =>
                  setEditing({ ...editing, subcategory: event.target.value })
                }
              />
            </label>
            <label className="form-item">
              <span>問題文</span>
              <textarea
                maxLength={QUESTION_LIMITS.longText}
                value={editing.text}
                onChange={(event) =>
                  setEditing({ ...editing, text: event.target.value })
                }
              />
            </label>
            <div className="choice-editor" role="group" aria-label="選択肢">
              <label>
                回答方式
                <select
                  value={editing.questionType ?? "single"}
                  onChange={(event) => {
                    const questionType = event.target.value as NonNullable<Question["questionType"]>;
                    const choices = questionType === "text" || editing.choices.length >= 2
                      ? editing.choices
                      : ["", ""];
                    const answerIndex = questionType === "single"
                      ? (editing.answerIndices?.[0] ?? editing.answerIndex ?? 0)
                      : editing.answerIndex;
                    const answerIndices = questionType === "multiple"
                      ? (editing.answerIndices?.length ? editing.answerIndices : [answerIndex])
                      : editing.answerIndices;
                    setEditing({ ...editing, questionType, choices, answerIndex, answerIndices });
                  }}
                >
                  <option value="single">択一</option><option value="multiple">複数選択</option><option value="text">入力</option>
                </select>
              </label>
              {editing.questionType === "text" ? (
                <label>
                  許容回答（1行1回答）
                  <textarea
                    maxLength={
                      QUESTION_LIMITS.longText *
                      QUESTION_LIMITS.maxAcceptedAnswers
                    }
                    value={(editing.acceptedAnswers ?? []).join("\n")}
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        acceptedAnswers: event.target.value
                          .split(/\r?\n/)
                          .map((value) => value.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </label>
              ) : editing.choices.map((choice, index) => (
                <label className="form-item" key={index}>
                  <span>
                    選択肢 {index + 1}
                    {(editing.questionType === "multiple"
                      ? (editing.answerIndices ?? []).includes(index)
                      : editing.answerIndex === index)
                      ? "（正解）"
                      : ""}
                  </span>
                  <div className="choice-edit-row">
                    <input
                      maxLength={QUESTION_LIMITS.longText}
                      value={choice}
                      onChange={(event) => {
                        const choices = [...editing.choices];
                        choices[index] = event.target.value;
                        setEditing({ ...editing, choices });
                      }}
                    />
                    <button
                      type="button"
                      aria-pressed={editing.questionType === "multiple" ? (editing.answerIndices ?? []).includes(index) : editing.answerIndex === index}
                      onClick={() => {
                        if (editing.questionType === "multiple") {
                          const current = editing.answerIndices ?? [];
                          const answerIndices = current.includes(index) ? current.filter((item) => item !== index) : [...current, index];
                          setEditing({ ...editing, answerIndices, answerIndex: answerIndices[0] ?? 0 });
                        } else setEditing({ ...editing, answerIndex: index, answerIndices: [index] });
                      }}
                    >
                      {editing.questionType === "multiple" ? "正解を切替" : "正解にする"}
                    </button>
                    {editing.choices.length > 2 && (
                      <button
                        className="delete-choice-button"
                        type="button"
                        onClick={() => {
                          const choices = editing.choices.filter(
                            (_, choiceIndex) => choiceIndex !== index,
                          );
                          const answerIndices = (editing.answerIndices ?? [])
                            .filter((answer) => answer !== index)
                            .map((answer) => (answer > index ? answer - 1 : answer));
                          const answerIndex = editing.questionType === "multiple"
                            ? (answerIndices[0] ?? 0)
                            : editing.answerIndex === index
                              ? 0
                              : editing.answerIndex > index
                                ? editing.answerIndex - 1
                                : editing.answerIndex;
                          setEditing({ ...editing, choices, answerIndex, answerIndices });
                        }}
                      >
                        削除
                      </button>
                    )}
                  </div>
                </label>
              ))}
              {editing.questionType !== "text" && editing.choices.length < QUESTION_LIMITS.maxChoices && (
                <button
                  className="inline-add-button"
                  type="button"
                  onClick={() =>
                    setEditing({
                      ...editing,
                      choices: [...editing.choices, ""],
                    })
                  }
                >
                  ＋ 選択肢を追加
                </button>
              )}
            </div>
            <label className="form-item">
              <span>解説</span>
              <textarea
                maxLength={QUESTION_LIMITS.longText}
                value={editing.explanation}
                onChange={(event) =>
                  setEditing({ ...editing, explanation: event.target.value })
                }
              />
            </label>
            <label className="form-item">
              <span>出典（任意）</span>
              <input
                maxLength={QUESTION_LIMITS.longText}
                value={editing.source ?? ""}
                onChange={(event) =>
                  setEditing({ ...editing, source: event.target.value })
                }
              />
            </label>
            <label className="form-item">
              <span>タグ（任意）</span>
              <input
                maxLength={QUESTION_LIMITS.longText}
                value={tagText}
                onChange={(event) => setTagText(event.target.value)}
                placeholder="カンマ区切り"
              />
            </label>
            <label className="form-item">
              <span>出題ウェイト</span>
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={editing.weight}
                onChange={(event) =>
                  setEditing({ ...editing, weight: Number(event.target.value) })
                }
              />
            </label>
            <label className="form-item">
              <span>難易度</span>
              <input
                type="number"
                min="1"
                max="5"
                value={editing.difficulty}
                onChange={(event) =>
                  setEditing({
                    ...editing,
                    difficulty: Number(event.target.value),
                  })
                }
              />
            </label>
          </div>
          {error && (
            <div className="error-box" role="alert">
              {error}
            </div>
          )}
          <button className="primary-button" type="button" onClick={save}>
            保存
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => setEditing(null)}
          >
            キャンセル
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="home-card question-admin-card">
        <h1>問題管理</h1>
        <div className="question-toolbar">
          <input
            aria-label="問題を検索"
            placeholder="問題文・ID・タグ・出典を検索"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select aria-label="試験枠" value={examScope} onChange={(event) => { setExamScope(event.target.value); setCategory("ALL"); }}>
            <option value="ALL">全試験枠</option>
            {examScopes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select
            aria-label="カテゴリ"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            {categories.map((item) => (
              <option key={item} value={item}>
                {item === "ALL" ? "全カテゴリ" : item}
              </option>
            ))}
          </select>
          <select
            aria-label="タグ"
            value={tag}
            onChange={(event) => setTag(event.target.value)}
          >
            {tags.map((item) => (
              <option key={item} value={item}>
                {item === "ALL" ? "全タグ" : item}
              </option>
            ))}
          </select>
          <select
            aria-label="ウェイト"
            value={weight}
            onChange={(event) => setWeight(event.target.value as WeightFilter)}
          >
            <option value="ALL">全ウェイト</option>
            <option value="HIGH">重要（3以上）</option>
            <option value="STANDARD">標準（3未満）</option>
          </select>
          <select
            aria-label="保管状態"
            value={archive}
            onChange={(event) =>
              setArchive(event.target.value as ArchiveFilter)
            }
          >
            <option value="ACTIVE">利用中</option>
            <option value="ARCHIVED">アーカイブ済み</option>
            <option value="ALL">すべて</option>
          </select>
        </div>
        <div className="question-count" aria-live="polite">
          {filtered.length} / {questions.length}件
        </div>
        {error && (
          <div className="error-box" role="alert">
            {error}
          </div>
        )}
        {message && (
          <div className="backup-success" role="status">
            {message}
          </div>
        )}
        <div className="question-list">
          {filtered.map((question) => (
            <article key={question.id} className="question-item">
              <div>
                <span>
                  {question.category}
                  {question.subcategory ? ` / ${question.subcategory}` : ""}
                </span>
                <strong>{question.text}</strong>
                <small>
                  {question.id}・ウェイト {question.weight}・難易度{" "}
                  {question.difficulty}・
                  {getMasteryLabel(
                    questionStates.find(
                      (state) => state.questionId === question.id,
                    )?.masteryLevel ?? "UNLEARNED",
                  )}
                  {question.archivedAt ? "・アーカイブ済み" : ""}
                </small>
                {(question.tags?.length ?? 0) > 0 && (
                  <div className="tag-list">
                    {question.tags?.map((item) => (
                      <b key={item}>{item}</b>
                    ))}
                  </div>
                )}
              </div>
              <div className="question-actions">
                <button type="button" onClick={() => startEdit(question)}>
                  編集
                </button>
                {question.archivedAt ? (
                  <button
                    type="button"
                    onClick={() => restoreQuestion(question.id)}
                  >
                    復元
                  </button>
                ) : (
                  <button
                    className="delete-button"
                    type="button"
                    onClick={(event) => {
                      event.currentTarget.focus();
                      setError("");
                      setMessage("");
                      setPendingArchive(question);
                    }}
                    aria-label={`問題 ${question.id} をアーカイブ`}
                  >
                    アーカイブ
                  </button>
                )}
              </div>
            </article>
          ))}
          {filtered.length === 0 && (
            <div className="empty-state">条件に一致する問題がありません。</div>
          )}
        </div>
        <button className="primary-button" type="button" onClick={startNew}>
          新しい問題を登録
        </button>
        <button className="secondary-button" type="button" onClick={onImport}>
          CSVから一括登録
        </button>
        <button className="secondary-button" type="button" onClick={onBack}>
          前のメニューへ戻る
        </button>
      </section>
      <ConfirmDialog
        open={pendingArchive !== null}
        title="問題をアーカイブしますか？"
        description={
          pendingArchive
            ? `問題 ${pendingArchive.id} を通常の出題から除外します。学習履歴は保持され、後から復元できます。`
            : ""
        }
        confirmLabel="アーカイブする"
        danger
        onConfirm={archiveQuestion}
        onCancel={() => setPendingArchive(null)}
      />
    </main>
  );
}
