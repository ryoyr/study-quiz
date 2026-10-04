


import { useMemo, useState } from 'react';
import type { MistakeNote } from '../types/MistakeNote';
import type { Question } from '../types/Question';
import type { StudyHistory } from '../types/StudyHistory';
import { upsertMistakeNote } from '../services/mistakeNoteStorage';

type Props = { questions: Question[]; history: StudyHistory[]; notes: MistakeNote[]; onChange: (notes: MistakeNote[]) => void; onStart: (questions: Question[]) => void; onBack: () => void };

export default function MistakeNotesPage({ questions, history, notes, onChange, onStart, onBack }: Props) {
  const mistakeQuestions = useMemo(() => {
    const wrongIds = new Set(history.filter((item) => !item.correct).map((item) => item.questionId));
    return questions.filter((question) => wrongIds.has(question.id));
  }, [questions, history]);
  const [selectedId, setSelectedId] = useState(mistakeQuestions[0]?.id ?? '');
  const selected = mistakeQuestions.find((item) => item.id === selectedId) ?? mistakeQuestions[0];
  const saved = notes.find((item) => item.questionId === selected?.id);
  const [cause, setCause] = useState(saved?.cause ?? '');
  const [correctKnowledge, setCorrectKnowledge] = useState(saved?.correctKnowledge ?? '');
  const [caution, setCaution] = useState(saved?.caution ?? '');
  const [message, setMessage] = useState('');
  const select = (id: string) => { const note = notes.find((item) => item.questionId === id); setSelectedId(id); setCause(note?.cause ?? ''); setCorrectKnowledge(note?.correctKnowledge ?? ''); setCaution(note?.caution ?? ''); setMessage(''); };
  const save = () => { if (!selected) return; const next = upsertMistakeNote(notes, { questionId: selected.id, cause: cause.trim(), correctKnowledge: correctKnowledge.trim(), caution: caution.trim(), updatedAt: new Date().toISOString() }); onChange(next); setMessage('間違いノートを保存しました。'); };
  return <main className="app-shell"><section className="home-card mistake-notes-card"><p className="eyebrow">MISTAKE NOTES</p><h1>間違いノート</h1>{mistakeQuestions.length === 0 ? <div className="empty-state">誤答履歴がありません。</div> : <><label className="form-item"><span>問題</span><select value={selected?.id ?? ''} onChange={(e) => select(e.target.value)}>{mistakeQuestions.map((question) => <option key={question.id} value={question.id}>{question.category} / {question.text}</option>)}</select></label>{selected && <><div className="mistake-question"><strong>{selected.text}</strong><p>{selected.explanation}</p></div><label className="form-item"><span>誤答原因</span><textarea rows={3} value={cause} onChange={(e) => setCause(e.target.value)} placeholder="読み違い、知識不足、選択肢の混同など" /></label><label className="form-item"><span>正しい知識</span><textarea rows={4} value={correctKnowledge} onChange={(e) => setCorrectKnowledge(e.target.value)} placeholder="次回正解するための知識を整理" /></label><label className="form-item"><span>注意点</span><textarea rows={3} value={caution} onChange={(e) => setCaution(e.target.value)} placeholder="引っかけや見落としやすい条件" /></label><button className="primary-button" type="button" onClick={save}>ノートを保存</button><button className="weak-button" type="button" onClick={() => onStart(mistakeQuestions)}>誤答問題を復習</button>{message && <div className="backup-success">{message}</div>}</>}</>}<button className="secondary-button" type="button" onClick={onBack}>前のメニューへ戻る</button></section></main>;
}
