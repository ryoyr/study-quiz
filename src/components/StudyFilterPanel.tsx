import { useMemo, useState } from "react";
import type { ExamScope } from "../types/ExamScope";
import type { Question } from "../types/Question";
import type { QuestionState } from "../types/QuestionState";
import type { MasteryFilter, QuestionMode } from "../types/Setup";
import type { StudySelection } from "../services/studySelectionService.ts";
import { masteryForQuestion } from "../services/studySelectionService.ts";
import { normalizeStudyCategories } from "../services/studyRangeService.ts";
import {
  MASTERY_FILTER_OPTIONS,
  QUESTION_MODE_OPTIONS,
  normalizeMasteryFilters,
  normalizeQuestionModes,
  toggleExclusiveSelection,
} from "../services/studyOptionService.ts";
import HelpButton from "./HelpButton";

type Props = {
  value: StudySelection;
  examScopes: ExamScope[];
  questions: Question[];
  questionStates: QuestionState[];
  onChange: (value: StudySelection) => void;
  title?: string;
};

type ChipOption<T extends string> = { value: T; label: string };

type HorizontalOptionGroupProps<T extends string> = {
  legend: string;
  options: ReadonlyArray<ChipOption<T>>;
  selected: ReadonlySet<T>;
  onToggle: (value: T) => void;
  summary: string;
  disabled?: boolean;
};

function HorizontalOptionGroup<T extends string>({
  legend,
  options,
  selected,
  onToggle,
  summary,
  disabled = false,
}: HorizontalOptionGroupProps<T>) {
  return (
    <fieldset className="form-item horizontal-option-fieldset" disabled={disabled}>
      <legend>{legend}</legend>
      <div
        className="horizontal-option-scroller"
        tabIndex={0}
        aria-label={`${legend}。横方向にスクロールできます`}
      >
        {options.map((option) => (
          <label
            key={option.value}
            className={`option-chip ${selected.has(option.value) ? "is-selected" : ""}`}
          >
            <input
              type="checkbox"
              checked={selected.has(option.value)}
              onChange={() => onToggle(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      <small>{summary}・横にスワイプできます</small>
    </fieldset>
  );
}

export default function StudyFilterPanel({
  value,
  examScopes,
  questions,
  questionStates,
  onChange,
  title = "出題範囲",
}: Props) {
  const [open, setOpen] = useState(false);
  const scoped = useMemo(
    () =>
      questions.filter(
        (question) =>
          !question.archivedAt && question.examScopeId === value.examScopeId,
      ),
    [questions, value.examScopeId],
  );
  const categories = useMemo(
    () =>
      [...new Set(scoped.map((question) => question.category))].sort((left, right) =>
        left.localeCompare(right, "ja"),
      ),
    [scoped],
  );
  const normalizedCategories = useMemo(
    () => normalizeStudyCategories(value.categories),
    [value.categories],
  );
  const normalizedMastery = useMemo(
    () => normalizeMasteryFilters(value.masteryFilters),
    [value.masteryFilters],
  );
  const normalizedModes = useMemo(
    () => normalizeQuestionModes(value.questionModes),
    [value.questionModes],
  );
  const selectedCategories = useMemo(
    () => new Set(normalizedCategories),
    [normalizedCategories],
  );
  const selectedMastery = useMemo(
    () => new Set(normalizedMastery),
    [normalizedMastery],
  );
  const selectedModes = useMemo(
    () => new Set(normalizedModes),
    [normalizedModes],
  );
  const visible = useMemo(
    () =>
      scoped.filter((question) => {
        const mastery = masteryForQuestion(question.id, questionStates);
        return (
          (selectedCategories.has("ALL") ||
            selectedCategories.has(question.category)) &&
          (selectedMastery.has("ALL") || selectedMastery.has(mastery))
        );
      }),
    [questionStates, scoped, selectedCategories, selectedMastery],
  );
  const selectedQuestions = new Set(value.questionIds);
  const patch = (partial: Partial<StudySelection>) =>
    onChange({ ...value, ...partial });
  const toggleQuestion = (id: string) =>
    patch({
      questionIds: selectedQuestions.has(id)
        ? value.questionIds.filter((item) => item !== id)
        : [...value.questionIds, id],
    });
  const toggleCategory = (category: string) => {
    if (category === "ALL") {
      patch({ categories: ["ALL"], questionIds: [] });
      return;
    }
    const withoutAll = normalizedCategories.filter((item) => item !== "ALL");
    const next = withoutAll.includes(category)
      ? withoutAll.filter((item) => item !== category)
      : [...withoutAll, category];
    patch({ categories: next.length > 0 ? next : ["ALL"], questionIds: [] });
  };
  const toggleMastery = (mastery: MasteryFilter) =>
    patch({
      masteryFilters: toggleExclusiveSelection(
        normalizedMastery,
        mastery,
        "ALL",
      ),
      questionIds: [],
    });
  const toggleMode = (mode: QuestionMode) =>
    patch({
      questionModes: toggleExclusiveSelection(
        normalizedModes,
        mode,
        "ADAPTIVE",
      ),
    });

  return (
    <section className="study-filter-panel">
      <div className="study-filter-heading">
        <strong>{title}</strong>
        <HelpButton title="出題範囲と出題方法">
          試験枠、学習範囲、理解度で対象を絞り、複数の出題方法は候補を重複なく統合します。「すべて」は同じグループの他項目と同時選択されません。個別問題を選ぶと、その問題が最優先です。
        </HelpButton>
      </div>
      <div className="study-filter-grid">
        <label className="form-item study-scope-select">
          <span>試験枠</span>
          <select
            value={value.examScopeId}
            onChange={(event) =>
              patch({
                examScopeId: event.target.value,
                categories: ["ALL"],
                questionIds: [],
              })
            }
          >
            {examScopes
              .filter((item) => item.active)
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.examCode})
                </option>
              ))}
          </select>
        </label>
        <HorizontalOptionGroup
          legend="学習範囲（複数選択可）"
          options={[
            { value: "ALL", label: "全トピック" },
            ...categories.map((category) => ({ value: category, label: category })),
          ]}
          selected={selectedCategories}
          onToggle={toggleCategory}
          summary={
            selectedCategories.has("ALL")
              ? "全範囲を対象"
              : `${selectedCategories.size}件の範囲を選択中`
          }
        />
        <HorizontalOptionGroup
          legend="理解度（複数選択可・OR条件）"
          options={MASTERY_FILTER_OPTIONS}
          selected={selectedMastery}
          onToggle={toggleMastery}
          summary={
            selectedMastery.has("ALL")
              ? "すべての理解度を対象"
              : `${selectedMastery.size}件の理解度を選択中`
          }
        />
        <HorizontalOptionGroup
          legend="出題方法（複数選択可・候補を統合）"
          options={QUESTION_MODE_OPTIONS}
          selected={selectedModes}
          onToggle={toggleMode}
          summary={
            value.questionIds.length > 0
              ? "個別問題の指定中は選択内容を保留"
              : selectedModes.has("ALL")
                ? "条件一致する全問題を対象"
                : `${selectedModes.size}件の出題方法を選択中`
          }
        />
      </div>
      <div className="study-filter-actions">
        <button
          type="button"
          onClick={() =>
            patch({
              categories: ["ALL"],
              masteryFilters: ["ALL"],
              questionModes: ["ADAPTIVE"],
              questionIds: [],
            })
          }
        >
          条件を初期状態に戻す
        </button>
      </div>
      <button
        type="button"
        className="question-picker-toggle"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? "個別問題の選択を閉じる" : "出題する問題を個別に選ぶ"}
        <span>
          {value.questionIds.length > 0
            ? `${value.questionIds.length}問選択中`
            : `${visible.length}問が条件一致`}
        </span>
      </button>
      {open && (
        <div className="question-picker">
          <div className="question-picker-actions">
            <button
              type="button"
              onClick={() =>
                patch({ questionIds: visible.map((item) => item.id) })
              }
            >
              表示中をすべて選択
            </button>
            <button type="button" onClick={() => patch({ questionIds: [] })}>
              選択を解除
            </button>
          </div>
          <div className="question-picker-list">
            {visible.map((question) => {
              const mastery = masteryForQuestion(question.id, questionStates);
              return (
                <label key={question.id}>
                  <input
                    type="checkbox"
                    checked={selectedQuestions.has(question.id)}
                    onChange={() => toggleQuestion(question.id)}
                  />
                  <span>
                    <strong>{question.id}</strong>
                    {question.text}
                    <small>
                      {question.subcategory ?? question.category}・
                      {mastery === "UNLEARNED"
                        ? "未学習"
                        : mastery === "LEARNING"
                          ? "学習中"
                          : "習得済み"}
                    </small>
                  </span>
                </label>
              );
            })}
            {visible.length === 0 && (
              <p className="empty-state">条件に一致する問題がありません。</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
