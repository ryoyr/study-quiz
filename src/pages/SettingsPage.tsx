import { useState } from "react";
import { validateSetup, type SetupErrors } from "../services/setupValidation";
import type { Setup } from "../types/Setup";

type Props = {
  setup: Setup;
  onSave: (setup: Setup) => Promise<void>;
  onCancel: () => void;
};

type NumberKey =
  | "dailyNewLimit"
  | "dailyQuestionLimit"
  | "bufferRate"
  | "instantThresholdSeconds"
  | "dailyMinimumQuestions";

const parseReservedDates = (value: string): string[] =>
  value
    .split(/[\s,、]+/)
    .map((item) => item.trim())
    .filter(Boolean);

export default function SettingsPage({ setup, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState<Setup>({
    ...setup,
    reservedDates: setup.reservedDates ?? [],
  });
  const [reservedDatesText, setReservedDatesText] = useState(
    (setup.reservedDates ?? []).join(", "),
  );
  const [errors, setErrors] = useState<SetupErrors>({});
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);

  const updateNumber = (key: NumberKey, value: string) => {
    setDraft((current) => ({
      ...current,
      [key]: value === "" ? Number.NaN : Number(value),
    }));
  };

  const save = async () => {
    if (saving) return;
    const next: Setup = {
      ...draft,
      name: draft.name.trim(),
      reservedDates: parseReservedDates(reservedDatesText),
      updatedAt: new Date().toISOString(),
    };
    const validationErrors = validateSetup(next);
    setErrors(validationErrors);
    setSaveError("");
    if (Object.keys(validationErrors).length > 0) return;

    setSaving(true);
    try {
      await onSave(next);
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "設定を保存できませんでした。",
      );
    } finally {
      setSaving(false);
    }
  };

  const fieldError = (key: keyof SetupErrors) => {
    const message = errors[key];
    return message ? (
      <span id={`settings-${key}-error`} className="field-error">
        {message}
      </span>
    ) : null;
  };
  const errorProps = (key: keyof SetupErrors) => ({
    "aria-invalid": Boolean(errors[key]),
    "aria-describedby": errors[key] ? `settings-${key}-error` : undefined,
  });

  return (
    <main className="app-shell">
      <section className="home-card settings-card">
        <h1>学習設定</h1>
        <p className="planning-note">
          バックアップと復元は「その他」→「完全バックアップ」で管理できます。
        </p>
        <div className="form-grid">
          <label className="form-item">
            <span>試験名</span>
            <input
              {...errorProps("name")}
              maxLength={120}
              value={draft.name}
              onChange={(event) =>
                setDraft({ ...draft, name: event.target.value })
              }
            />
            {fieldError("name")}
          </label>
          <label className="form-item">
            <span>試験日</span>
            <input
              {...errorProps("examDate")}
              type="date"
              value={draft.examDate}
              onChange={(event) =>
                setDraft({ ...draft, examDate: event.target.value })
              }
            />
            {fieldError("examDate")}
          </label>
          <label className="form-item">
            <span>1日の新規問題上限</span>
            <input
              {...errorProps("dailyNewLimit")}
              inputMode="numeric"
              type="number"
              min="1"
              max="500"
              value={
                Number.isNaN(draft.dailyNewLimit) ? "" : draft.dailyNewLimit
              }
              onChange={(event) =>
                updateNumber("dailyNewLimit", event.target.value)
              }
            />
            {fieldError("dailyNewLimit")}
          </label>
          <label className="form-item">
            <span>1日の総問題数上限</span>
            <input
              {...errorProps("dailyQuestionLimit")}
              inputMode="numeric"
              type="number"
              min="1"
              max="1000"
              value={
                Number.isNaN(draft.dailyQuestionLimit)
                  ? ""
                  : draft.dailyQuestionLimit
              }
              onChange={(event) =>
                updateNumber("dailyQuestionLimit", event.target.value)
              }
            />
            {fieldError("dailyQuestionLimit")}
          </label>
          <label className="form-item">
            <span>バッファ率（%）</span>
            <input
              {...errorProps("bufferRate")}
              inputMode="decimal"
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={Number.isNaN(draft.bufferRate) ? "" : draft.bufferRate}
              onChange={(event) =>
                updateNumber("bufferRate", event.target.value)
              }
            />
            {fieldError("bufferRate")}
          </label>
          <label className="form-item">
            <span>即答判定秒数</span>
            <input
              {...errorProps("instantThresholdSeconds")}
              inputMode="numeric"
              type="number"
              min="1"
              max="3600"
              value={
                Number.isNaN(draft.instantThresholdSeconds)
                  ? ""
                  : draft.instantThresholdSeconds
              }
              onChange={(event) =>
                updateNumber("instantThresholdSeconds", event.target.value)
              }
            />
            {fieldError("instantThresholdSeconds")}
          </label>
          <label className="form-item">
            <span>今日の最低ライン（問）</span>
            <input
              {...errorProps("dailyMinimumQuestions")}
              inputMode="numeric"
              type="number"
              min="1"
              max={draft.dailyQuestionLimit || 1}
              value={
                Number.isNaN(draft.dailyMinimumQuestions)
                  ? ""
                  : draft.dailyMinimumQuestions
              }
              onChange={(event) =>
                updateNumber("dailyMinimumQuestions", event.target.value)
              }
            />
            <small>忙しい日に最低限回答する問題数です。</small>
            {fieldError("dailyMinimumQuestions")}
          </label>
          <label className="form-item">
            <span>学習しない日</span>
            <input
              {...errorProps("reservedDates")}
              value={reservedDatesText}
              onChange={(event) => setReservedDatesText(event.target.value)}
              placeholder="2026-10-10, 2026-10-15"
            />
            <small>
              カンマまたは空白区切り。本日から試験日前日まで指定できます。
            </small>
            {fieldError("reservedDates")}
          </label>
        </div>
        {saveError && (
          <div className="error-box" role="alert">
            {saveError}
          </div>
        )}
        <button
          className="primary-button"
          type="button"
          disabled={saving}
          onClick={() => void save()}
        >
          {saving ? "保存中..." : "設定を保存"}
        </button>
        <button
          className="secondary-button"
          type="button"
          disabled={saving}
          onClick={onCancel}
        >
          変更せず戻る
        </button>
      </section>
    </main>
  );
}
