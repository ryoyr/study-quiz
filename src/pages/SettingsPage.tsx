import { useState } from "react";
import GeminiSettingsSection from "../components/GeminiSettingsSection";
import HelpButton from "../components/HelpButton";
import NonStudyDayPicker from "../components/NonStudyDayPicker";
import StudyFilterPanel from "../components/StudyFilterPanel";
import { normalizeReservedDates, normalizeReservedWeekdays } from "../services/reservedDayService";
import { selectionFromSetup, type StudySelection } from "../services/studySelectionService.ts";
import { validateSetup, type SetupErrors } from "../services/setupValidation";
import type { ExamScope } from "../types/ExamScope";
import type { Question } from "../types/Question";
import type { QuestionState } from "../types/QuestionState";
import type { Setup } from "../types/Setup";

type Props = {
  setup: Setup;
  examScopes: ExamScope[];
  questions: Question[];
  questionStates: QuestionState[];
  onSave: (setup: Setup) => Promise<void>;
  onCancel: () => void;
};
type NumberKey = "dailyNewLimit" | "dailyQuestionLimit" | "bufferRate" | "instantThresholdSeconds" | "dailyMinimumQuestions";

const applySelection = (setup: Setup, selection: StudySelection): Setup => ({
  ...setup,
  examScopeId: selection.examScopeId,
  defaultCategory: selection.category,
  defaultMasteryFilter: selection.masteryFilter,
  defaultQuestionMode: selection.questionMode,
  defaultQuestionIds: selection.questionIds,
});

export default function SettingsPage({ setup, examScopes, questions, questionStates, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState<Setup>({ ...setup, reservedDates: setup.reservedDates ?? [], reservedWeekdays: setup.reservedWeekdays ?? [] });
  const [errors, setErrors] = useState<SetupErrors>({});
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const updateNumber = (key: NumberKey, value: string) => setDraft((current) => ({ ...current, [key]: value === "" ? Number.NaN : Number(value) }));
  const save = async () => {
    if (saving) return;
    const next: Setup = { ...draft, name: draft.name.trim(), reservedDates: normalizeReservedDates(draft.reservedDates), reservedWeekdays: normalizeReservedWeekdays(draft.reservedWeekdays), updatedAt: new Date().toISOString() };
    const validationErrors = validateSetup(next);
    setErrors(validationErrors);
    setSaveError("");
    if (Object.keys(validationErrors).length > 0) return;
    setSaving(true);
    try { await onSave(next); }
    catch (error) { setSaveError(error instanceof Error ? error.message : "設定を保存できませんでした。"); }
    finally { setSaving(false); }
  };
  const fieldError = (key: keyof SetupErrors) => errors[key] ? <span id={`settings-${key}-error`} className="field-error">{errors[key]}</span> : null;
  const errorProps = (key: keyof SetupErrors) => ({ "aria-invalid": Boolean(errors[key]), "aria-describedby": errors[key] ? `settings-${key}-error` : undefined });

  return (
    <main className="app-shell">
      <section className="home-card settings-card">
        <div className="page-title-with-help"><h1>学習設定</h1><HelpButton title="学習設定">ここで選んだ試験枠・学習範囲・理解度・出題方法が、ホームと学習画面の初期値になります。</HelpButton></div>
        <p className="planning-note">試験計画、出題の初期値、表示テーマ、学習しない日をまとめて設定できます。</p>

        <section className="settings-section">
          <h2>出題の初期値</h2>
          <StudyFilterPanel
            title="ホームと学習画面の既定条件"
            value={selectionFromSetup(draft)}
            examScopes={examScopes}
            questions={questions}
            questionStates={questionStates}
            onChange={(selection) => setDraft((current) => applySelection(current, selection))}
          />
        </section>

        <section className="settings-section">
          <div className="section-heading-with-help"><h2>試験計画と表示</h2><HelpButton title="試験計画">日次上限と学習しない日から、試験日までに必要な新規問題数を計算します。</HelpButton></div>
          <div className="form-grid settings-form-grid">
            <label className="form-item"><span>表示名</span><input {...errorProps("name")} maxLength={120} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />{fieldError("name")}</label>
            <label className="form-item date-form-item"><span>試験日</span><input {...errorProps("examDate")} type="date" value={draft.examDate} onChange={(event) => setDraft({ ...draft, examDate: event.target.value })} />{fieldError("examDate")}</label>
            <label className="form-item"><span>テーマ</span><select value={draft.theme} onChange={(event) => setDraft({ ...draft, theme: event.target.value as Setup["theme"] })}><option value="system">端末設定に合わせる</option><option value="light">ライト</option><option value="dark">ダーク</option></select>{fieldError("theme")}</label>
            <label className="form-item"><span>1日の新規問題上限</span><input {...errorProps("dailyNewLimit")} inputMode="numeric" type="number" min="1" max="500" value={Number.isNaN(draft.dailyNewLimit) ? "" : draft.dailyNewLimit} onChange={(event) => updateNumber("dailyNewLimit", event.target.value)} />{fieldError("dailyNewLimit")}</label>
            <label className="form-item"><span>1日の総問題数上限</span><input {...errorProps("dailyQuestionLimit")} inputMode="numeric" type="number" min="1" max="1000" value={Number.isNaN(draft.dailyQuestionLimit) ? "" : draft.dailyQuestionLimit} onChange={(event) => updateNumber("dailyQuestionLimit", event.target.value)} />{fieldError("dailyQuestionLimit")}</label>
            <label className="form-item"><span>バッファ率（%）</span><input {...errorProps("bufferRate")} inputMode="decimal" type="number" min="0" max="100" step="0.1" value={Number.isNaN(draft.bufferRate) ? "" : draft.bufferRate} onChange={(event) => updateNumber("bufferRate", event.target.value)} />{fieldError("bufferRate")}</label>
            <label className="form-item"><span>即答判定秒数</span><input {...errorProps("instantThresholdSeconds")} inputMode="numeric" type="number" min="1" max="3600" value={Number.isNaN(draft.instantThresholdSeconds) ? "" : draft.instantThresholdSeconds} onChange={(event) => updateNumber("instantThresholdSeconds", event.target.value)} />{fieldError("instantThresholdSeconds")}</label>
            <label className="form-item"><span>今日の最低ライン（問）</span><input {...errorProps("dailyMinimumQuestions")} inputMode="numeric" type="number" min="1" max={draft.dailyQuestionLimit || 1} value={Number.isNaN(draft.dailyMinimumQuestions) ? "" : draft.dailyMinimumQuestions} onChange={(event) => updateNumber("dailyMinimumQuestions", event.target.value)} /><small>忙しい日に最低限回答する問題数です。</small>{fieldError("dailyMinimumQuestions")}</label>
          </div>
          <NonStudyDayPicker examDate={draft.examDate} reservedDates={draft.reservedDates} reservedWeekdays={draft.reservedWeekdays ?? []} error={errors.reservedDates} errorId="settings-reservedDates-error" onChange={(reservedDates, reservedWeekdays) => setDraft((current) => ({ ...current, reservedDates, reservedWeekdays }))} />
        </section>
        {saveError && <div className="error-box" role="alert">{saveError}</div>}
        <div className="settings-save-actions"><button className="primary-button" type="button" disabled={saving} onClick={() => void save()}>{saving ? "保存中..." : "学習設定を保存"}</button><button className="secondary-button" type="button" disabled={saving} onClick={onCancel}>変更せず戻る</button></div>
        <GeminiSettingsSection />
      </section>
    </main>
  );
}
