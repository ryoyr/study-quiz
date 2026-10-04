import { useRef, useState } from 'react';
import type { Setup } from '../types/Setup';
import type { StudyHistory } from '../types/StudyHistory';
import type { QuestionState } from '../types/QuestionState';
import { validateSetup } from '../services/setupValidation';
import type { SetupErrors } from '../services/setupValidation';
import { downloadBackup, restoreBackupText } from '../services/backupService';

type Props = {
  setup: Setup;
  history: StudyHistory[];
  questionStates: QuestionState[];
  onSave: (setup: Setup) => Promise<void>;
  onRestore: (setup: Setup, history: StudyHistory[], questionStates: QuestionState[]) => Promise<void>;
  onCancel: () => void;
};
type NumberKey = 'dailyNewLimit' | 'dailyQuestionLimit' | 'bufferRate' | 'instantThresholdSeconds' | 'dailyMinimumQuestions';

const parseReservedDates = (value: string): string[] => value.split(/[\s,、]+/).map((item) => item.trim()).filter(Boolean);

export default function SettingsPage({ setup, history, questionStates, onSave, onRestore, onCancel }: Props) {
  const [draft, setDraft] = useState<Setup>({ ...setup, reservedDates: setup.reservedDates ?? [] });
  const [reservedDatesText, setReservedDatesText] = useState((setup.reservedDates ?? []).join(', '));
  const [errors, setErrors] = useState<SetupErrors>({});
  const [backupMessage, setBackupMessage] = useState('');
  const [backupError, setBackupError] = useState('');
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const updateNumber = (key: NumberKey, value: string) => setDraft({ ...draft, [key]: value === '' ? Number.NaN : Number(value) });

  const save = async () => {
    if (saving) return;
    const next = { ...draft, name: draft.name.trim(), reservedDates: parseReservedDates(reservedDatesText), updatedAt: new Date().toISOString() };
    const validationErrors = validateSetup(next);
    setErrors(validationErrors);
    setBackupError('');
    if (Object.keys(validationErrors).length !== 0) return;
    setSaving(true);
    try {
      await onSave(next);
    } catch (error) {
      setBackupError('設定を保存できませんでした。ブラウザのストレージ設定を確認して再試行してください。');
      console.error('Settings save failed.', error);
    } finally {
      setSaving(false);
    }
  };

  const fieldError = (key: keyof SetupErrors) => errors[key] ? <span className="field-error">{errors[key]}</span> : null;
  const exportData = () => { setBackupError(''); downloadBackup(setup, history, questionStates); setBackupMessage('バックアップファイルを出力しました。'); };
  const importData = async (file: File) => {
    setBackupMessage('');
    setBackupError('');
    try {
      const result = restoreBackupText(await file.text());
      await onRestore(result.setup, result.history, result.questionStates);
      setDraft(result.setup);
      setReservedDatesText((result.setup.reservedDates ?? []).join(', '));
      setBackupMessage(`復元しました。回答履歴: ${result.history.length}件`);
    } catch (error) {
      setBackupError(error instanceof Error ? error.message : '復元に失敗しました。');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const numberValue = (value: number) => Number.isNaN(value) ? '' : value;

  return <main className="app-shell"><section className="home-card settings-card"><p className="eyebrow">SETTINGS</p><h1>設定・バックアップ</h1><div className="form-grid">
    <label className="form-item"><span>試験名</span><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}/>{fieldError('name')}</label>
    <label className="form-item"><span>試験日</span><input type="date" value={draft.examDate} onChange={(e) => setDraft({ ...draft, examDate: e.target.value })}/>{fieldError('examDate')}</label>
    <label className="form-item"><span>1日の新規問題上限</span><input type="number" min="1" max="500" value={numberValue(draft.dailyNewLimit)} onChange={(e) => updateNumber('dailyNewLimit', e.target.value)}/>{fieldError('dailyNewLimit')}</label>
    <label className="form-item"><span>1日の総問題数上限</span><input type="number" min="1" max="1000" value={numberValue(draft.dailyQuestionLimit)} onChange={(e) => updateNumber('dailyQuestionLimit', e.target.value)}/>{fieldError('dailyQuestionLimit')}</label>
    <label className="form-item"><span>バッファ率（%）</span><input type="number" min="0" max="100" value={numberValue(draft.bufferRate)} onChange={(e) => updateNumber('bufferRate', e.target.value)}/>{fieldError('bufferRate')}</label>
    <label className="form-item"><span>即答判定秒数</span><input type="number" min="1" max="3600" value={numberValue(draft.instantThresholdSeconds)} onChange={(e) => updateNumber('instantThresholdSeconds', e.target.value)}/>{fieldError('instantThresholdSeconds')}</label>
    <label className="form-item"><span>今日の最低ライン（問）</span><input type="number" min="1" max={draft.dailyQuestionLimit} value={numberValue(draft.dailyMinimumQuestions)} onChange={(e) => updateNumber('dailyMinimumQuestions', e.target.value)}/><small>忙しい日に最低限回答する問題数です。</small>{fieldError('dailyMinimumQuestions')}</label>
    <label className="form-item"><span>学習しない日</span><input value={reservedDatesText} onChange={(e) => setReservedDatesText(e.target.value)} placeholder="2026-10-10, 2026-10-15"/><small>カンマまたは空白区切り。本日から試験日前日まで指定できます。</small>{fieldError('reservedDates')}</label>
  </div><button className="primary-button" type="button" disabled={saving} onClick={() => void save()}>{saving ? '保存中...' : '設定を保存'}</button><button className="secondary-button" type="button" disabled={saving} onClick={onCancel}>変更せず戻る</button>
  <section className="backup-section"><h2>バックアップ・復元</h2><p>設定と回答履歴をJSONファイルへ保存します。</p><button className="backup-button" type="button" onClick={exportData}>JSONバックアップを出力</button><input ref={fileRef} className="file-input" type="file" accept="application/json,.json" onChange={(e) => { const file = e.target.files?.[0]; if (file) void importData(file); }}/><button className="restore-button" type="button" onClick={() => fileRef.current?.click()}>JSONバックアップから復元</button>{backupMessage && <div className="backup-success">{backupMessage}</div>}{backupError && <div className="error-box" role="alert">{backupError}</div>}</section>
  </section></main>;
}
