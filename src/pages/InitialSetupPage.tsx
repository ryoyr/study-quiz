

import { useState } from 'react';
import { validateSetup } from '../services/setupValidation';
import type { SetupErrors } from '../services/setupValidation';
import type { Setup } from '../types/Setup';

type Props = {
  setup: Setup;
  onSave: (setup: Setup) => Promise<void>;
};

type NumberKey =
  | 'dailyNewLimit'
  | 'dailyQuestionLimit'
  | 'bufferRate'
  | 'instantThresholdSeconds'
  | 'dailyMinimumQuestions';

const parseReservedDates = (value: string): string[] =>
  value
    .split(/[\s,、]+/)
    .map((item) => item.trim())
    .filter(Boolean);

export default function InitialSetupPage({ setup, onSave }: Props) {
  const [draft, setDraft] = useState<Setup>({
    ...setup,
    reservedDates: setup.reservedDates ?? [],
  });
  const [reservedDatesText, setReservedDatesText] = useState(
    (setup.reservedDates ?? []).join(', '),
  );
  const [errors, setErrors] = useState<SetupErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const updateNumber = (key: NumberKey, value: string) => {
    setDraft({ ...draft, [key]: value === '' ? 0 : Number(value) });
  };

  const save = async () => {
    if (saving) return;
    const now = new Date().toISOString();
    const next: Setup = {
      ...draft,
      name: draft.name.trim(),
      reservedDates: parseReservedDates(reservedDatesText),
      setupCompleted: true,
      createdAt: draft.createdAt || now,
      updatedAt: now,
    };
    const validationErrors = validateSetup(next);
    setErrors(validationErrors);
    setSaveError('');
    if (Object.keys(validationErrors).length !== 0) return;
    setSaving(true);
    try {
      await onSave(next);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : '設定を保存できませんでした。');
    } finally {
      setSaving(false);
    }
  };

  const error = (key: keyof SetupErrors) =>
    errors[key] ? <span className="field-error">{errors[key]}</span> : null;

  return (
    <main className="app-shell">
      <section className="home-card settings-card">
        <h1>初回設定</h1>
        <p className="planning-note">
          学習計画に必要な情報を入力してください。保存後はホーム画面へ移動します。
        </p>
        <div className="form-grid">
          <label className="form-item">
            <span>試験名</span>
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            {error('name')}
          </label>
          <label className="form-item">
            <span>試験日</span>
            <input type="date" value={draft.examDate} onChange={(e) => setDraft({ ...draft, examDate: e.target.value })} />
            {error('examDate')}
          </label>
          <label className="form-item">
            <span>1日の新規問題上限</span>
            <input type="number" min="1" max="500" value={draft.dailyNewLimit} onChange={(e) => updateNumber('dailyNewLimit', e.target.value)} />
            {error('dailyNewLimit')}
          </label>
          <label className="form-item">
            <span>1日の総問題数上限</span>
            <input type="number" min="1" max="1000" value={draft.dailyQuestionLimit} onChange={(e) => updateNumber('dailyQuestionLimit', e.target.value)} />
            {error('dailyQuestionLimit')}
          </label>
          <label className="form-item">
            <span>バッファ率（%）</span>
            <input type="number" min="0" max="100" value={draft.bufferRate} onChange={(e) => updateNumber('bufferRate', e.target.value)} />
            {error('bufferRate')}
          </label>
          <label className="form-item">
            <span>即答判定秒数</span>
            <input type="number" min="1" max="3600" value={draft.instantThresholdSeconds} onChange={(e) => updateNumber('instantThresholdSeconds', e.target.value)} />
            {error('instantThresholdSeconds')}
          </label>
          <label className="form-item">
            <span>今日の最低ライン（問）</span>
            <input type="number" min="1" max={draft.dailyQuestionLimit} value={draft.dailyMinimumQuestions} onChange={(e) => updateNumber('dailyMinimumQuestions', e.target.value)} />
            <small>忙しい日に最低限回答する問題数です。</small>
            {error('dailyMinimumQuestions')}
          </label>
          <label className="form-item">
            <span>学習しない日</span>
            <input value={reservedDatesText} onChange={(e) => setReservedDatesText(e.target.value)} placeholder="2026-10-10, 2026-10-15" />
            <small>カンマまたは空白区切り。本日から試験日前日まで指定できます。</small>
            {error('reservedDates')}
          </label>
        </div>
        {saveError && <div className="error-box" role="alert">{saveError}</div>}
        <button className="primary-button" type="button" disabled={saving} onClick={() => void save()}>
          {saving ? '保存中...' : '保存して開始'}
        </button>
      </section>
    </main>
  );
}
