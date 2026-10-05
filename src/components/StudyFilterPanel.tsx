import { useMemo, useState } from "react";
import type { ExamScope } from "../types/ExamScope";
import type { Question } from "../types/Question";
import type { QuestionState } from "../types/QuestionState";
import type { MasteryFilter, QuestionMode } from "../types/Setup";
import type { StudySelection } from "../services/studySelectionService.ts";
import { masteryForQuestion } from "../services/studySelectionService.ts";
import { normalizeStudyCategories } from "../services/studyRangeService.ts";
import HelpButton from "./HelpButton";

type Props = {
  value: StudySelection;
  examScopes: ExamScope[];
  questions: Question[];
  questionStates: QuestionState[];
  onChange: (value: StudySelection) => void;
  title?: string;
};

const MASTERY_OPTIONS: Array<{ value: MasteryFilter; label: string }> = [
  { value: "ALL", label: "すべての理解度" },
  { value: "UNLEARNED", label: "未学習" },
  { value: "LEARNING", label: "学習中" },
  { value: "MASTERED", label: "習得済み" },
];
const MODE_OPTIONS: Array<{ value: QuestionMode; label: string }> = [
  { value: "ADAPTIVE", label: "おすすめ（期限・弱点・新規）" },
  { value: "NEW", label: "未回答のみ" },
  { value: "REVIEW", label: "復習期限のみ" },
  { value: "WEAK", label: "苦手のみ" },
  { value: "ALL", label: "条件一致から出題" },
];

export default function StudyFilterPanel({ value, examScopes, questions, questionStates, onChange, title = "出題範囲" }: Props) {
  const [open, setOpen] = useState(false);
  const scoped = useMemo(() => questions.filter((question) => !question.archivedAt && question.examScopeId === value.examScopeId), [questions, value.examScopeId]);
  const categories = useMemo(() => [...new Set(scoped.map((question) => question.category))].sort((left, right) => left.localeCompare(right, "ja")), [scoped]);
  const selectedCategories = useMemo(() => new Set(normalizeStudyCategories(value.categories)), [value.categories]);
  const visible = useMemo(() => scoped.filter((question) =>
    (selectedCategories.has("ALL") || selectedCategories.has(question.category)) &&
    (value.masteryFilter === "ALL" || masteryForQuestion(question.id, questionStates) === value.masteryFilter)),
  [questionStates, scoped, selectedCategories, value.masteryFilter]);
  const selected = new Set(value.questionIds);
  const patch = (partial: Partial<StudySelection>) => onChange({ ...value, ...partial });
  const toggle = (id: string) => patch({ questionIds: selected.has(id) ? value.questionIds.filter((item) => item !== id) : [...value.questionIds, id] });
  const toggleCategory = (category: string) => {
    if (category === "ALL") {
      patch({ categories: ["ALL"], questionIds: [] });
      return;
    }
    const next = selectedCategories.has("ALL")
      ? [category]
      : selectedCategories.has(category)
        ? value.categories.filter((item) => item !== category)
        : [...value.categories, category];
    patch({ categories: next.length > 0 ? next : ["ALL"], questionIds: [] });
  };

  return (
    <section className="study-filter-panel">
      <div className="study-filter-heading">
        <strong>{title}</strong>
        <HelpButton title="出題範囲と出題方法">試験枠→複数の学習範囲→理解度の順で対象を絞ります。全トピックを選ぶと範囲指定を解除します。個別問題を選ぶと、その問題が最優先で出題されます。</HelpButton>
      </div>
      <div className="study-filter-grid">
        <label className="form-item"><span>試験枠</span><select value={value.examScopeId} onChange={(event) => patch({ examScopeId: event.target.value, categories: ["ALL"], questionIds: [] })}>{examScopes.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name} ({item.examCode})</option>)}</select></label>
        <fieldset className="form-item study-range-fieldset">
          <legend>学習範囲（複数選択可）</legend>
          <div className="study-range-options">
            <label className={selectedCategories.has("ALL") ? "is-selected" : ""}>
              <input type="checkbox" checked={selectedCategories.has("ALL")} onChange={() => toggleCategory("ALL")} />
              <span>全トピック</span>
            </label>
            {categories.map((category) => (
              <label key={category} className={selectedCategories.has(category) ? "is-selected" : ""}>
                <input type="checkbox" checked={selectedCategories.has(category)} onChange={() => toggleCategory(category)} />
                <span>{category}</span>
              </label>
            ))}
          </div>
          <small>{selectedCategories.has("ALL") ? "全範囲を対象" : `${selectedCategories.size}件の範囲を選択中`}</small>
        </fieldset>
        <label className="form-item"><span>理解度</span><select value={value.masteryFilter} onChange={(event) => patch({ masteryFilter: event.target.value as MasteryFilter, questionIds: [] })}>{MASTERY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label className="form-item"><span>出題方法</span><select value={value.questionMode} disabled={value.questionIds.length > 0} onChange={(event) => patch({ questionMode: event.target.value as QuestionMode })}>{MODE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      </div>
      <button type="button" className="question-picker-toggle" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        {open ? "個別問題の選択を閉じる" : "出題する問題を個別に選ぶ"}
        <span>{value.questionIds.length > 0 ? `${value.questionIds.length}問選択中` : `${visible.length}問が条件一致`}</span>
      </button>
      {open && (
        <div className="question-picker">
          <div className="question-picker-actions">
            <button type="button" onClick={() => patch({ questionIds: visible.map((item) => item.id) })}>表示中をすべて選択</button>
            <button type="button" onClick={() => patch({ questionIds: [] })}>選択を解除</button>
          </div>
          <div className="question-picker-list">
            {visible.map((question) => (
              <label key={question.id}>
                <input type="checkbox" checked={selected.has(question.id)} onChange={() => toggle(question.id)} />
                <span><strong>{question.id}</strong>{question.text}<small>{question.subcategory ?? question.category}・{masteryForQuestion(question.id, questionStates) === "UNLEARNED" ? "未学習" : masteryForQuestion(question.id, questionStates) === "LEARNING" ? "学習中" : "習得済み"}</small></span>
              </label>
            ))}
            {visible.length === 0 && <p className="empty-state">条件に一致する問題がありません。</p>}
          </div>
        </div>
      )}
    </section>
  );
}
