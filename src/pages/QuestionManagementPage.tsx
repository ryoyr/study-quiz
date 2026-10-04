
import { useEffect, useMemo, useState } from 'react';
import type { Question } from '../types/Question';
import type { QuestionState } from '../types/QuestionState';
import { getMasteryLabel } from '../services/questionStateService';

type Props = {
  questions: Question[];
  questionStates: QuestionState[];
  initialQuestionId?: string;
  onInitialEditHandled?: () => void;
  onChange: (items: Question[]) => void;
  onImport: () => void;
  onBack: () => void;
};

type WeightFilter = 'ALL' | 'HIGH' | 'STANDARD';

const emptyQuestion = (): Question => ({
  id: '',
  category: '',
  subcategory: '',
  text: '',
  choices: ['', '', '', ''],
  answerIndex: 0,
  explanation: '',
  source: '',
  tags: [],
  weight: 1,
  difficulty: 1,
});

const parseTags = (value: string): string[] => [...new Set(value.split(/[,、]/).map((tag) => tag.trim()).filter(Boolean))];

export default function QuestionManagementPage({
  questions,
  questionStates,
  initialQuestionId = '',
  onInitialEditHandled,
  onChange,
  onImport,
  onBack,
}: Props) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('ALL');
  const [tag, setTag] = useState('ALL');
  const [weight, setWeight] = useState<WeightFilter>('ALL');
  const [editing, setEditing] = useState<Question | null>(null);
  const [originalId, setOriginalId] = useState('');
  const [tagText, setTagText] = useState('');
  const [error, setError] = useState('');

  const categories = useMemo(() => ['ALL', ...new Set(questions.map((question) => question.category))], [questions]);
  const tags = useMemo(() => ['ALL', ...new Set(questions.flatMap((question) => question.tags ?? []))], [questions]);
  const filtered = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('ja');
    return questions.filter((question) => {
      const searchable = [
        question.id,
        question.category,
        question.subcategory ?? '',
        question.text,
        question.explanation,
        question.source ?? '',
        ...(question.tags ?? []),
      ].join(' ').toLocaleLowerCase('ja');
      const matchesWeight = weight === 'ALL' || (weight === 'HIGH' ? question.weight >= 3 : question.weight < 3);
      return (category === 'ALL' || question.category === category)
        && (tag === 'ALL' || question.tags?.includes(tag))
        && matchesWeight
        && (!keyword || searchable.includes(keyword));
    });
  }, [category, questions, search, tag, weight]);

  const startNew = () => {
    setOriginalId('');
    setEditing(emptyQuestion());
    setTagText('');
    setError('');
  };
  const startEdit = (question: Question) => {
    setOriginalId(question.id);
    setEditing({ ...question, choices: [...question.choices], tags: [...(question.tags ?? [])] });
    setTagText((question.tags ?? []).join(', '));
    setError('');
  };

  useEffect(() => {
    if (!initialQuestionId) return;
    const target = questions.find((question) => question.id === initialQuestionId);
    if (target) startEdit(target);
    onInitialEditHandled?.();
  }, [initialQuestionId, onInitialEditHandled, questions]);

  const save = () => {
    if (!editing) return;
    const id = editing.id.trim();
    const choices = editing.choices.map((choice) => choice.trim());
    if (!id || !editing.category.trim() || !editing.text.trim()) {
      setError('問題ID、カテゴリ、問題文は必須です。');
      return;
    }
    if (choices.length < 2 || choices.some((choice) => !choice)) {
      setError('選択肢は2件以上、すべて入力してください。');
      return;
    }
    if (questions.some((question) => question.id === id && question.id !== originalId)) {
      setError('同じ問題IDが既に存在します。');
      return;
    }
    if (editing.answerIndex < 0 || editing.answerIndex >= choices.length) {
      setError('正解の選択肢を指定してください。');
      return;
    }
    if (!Number.isFinite(editing.weight) || editing.weight <= 0) {
      setError('出題ウェイトは0より大きい数値で指定してください。');
      return;
    }
    if (!Number.isInteger(editing.difficulty) || editing.difficulty < 1 || editing.difficulty > 5) {
      setError('難易度は1～5の整数で指定してください。');
      return;
    }
    const next: Question = {
      ...editing,
      id,
      category: editing.category.trim(),
      subcategory: editing.subcategory?.trim() || undefined,
      text: editing.text.trim(),
      choices,
      explanation: editing.explanation.trim(),
      source: editing.source?.trim() || undefined,
      tags: parseTags(tagText),
    };
    onChange(originalId ? questions.map((question) => question.id === originalId ? next : question) : [...questions, next]);
    setEditing(null);
  };

  const remove = (id: string) => {
    if (!window.confirm(`問題 ${id} を削除しますか？関連する学習履歴は残ります。`)) return;
    onChange(questions.filter((question) => question.id !== id));
  };

  if (editing) {
    return (
      <main className="app-shell">
        <section className="home-card question-admin-card">
          <h1>{originalId ? '問題編集' : '問題登録'}</h1>
          <div className="form-grid">
            <label className="form-item"><span>問題ID</span><input value={editing.id} onChange={(event) => setEditing({ ...editing, id: event.target.value })} /></label>
            <label className="form-item"><span>カテゴリ</span><input value={editing.category} onChange={(event) => setEditing({ ...editing, category: event.target.value })} /></label>
            <label className="form-item"><span>サブカテゴリ（任意）</span><input value={editing.subcategory ?? ''} onChange={(event) => setEditing({ ...editing, subcategory: event.target.value })} /></label>
            <label className="form-item"><span>問題文</span><textarea value={editing.text} onChange={(event) => setEditing({ ...editing, text: event.target.value })} /></label>
            <div className="choice-editor" role="group" aria-label="選択肢">
              {editing.choices.map((choice, index) => (
                <label className="form-item" key={index}>
                  <span>選択肢 {index + 1}{editing.answerIndex === index ? '（正解）' : ''}</span>
                  <div className="choice-edit-row">
                    <input value={choice} onChange={(event) => {
                      const choices = [...editing.choices];
                      choices[index] = event.target.value;
                      setEditing({ ...editing, choices });
                    }} />
                    <button type="button" aria-pressed={editing.answerIndex === index} onClick={() => setEditing({ ...editing, answerIndex: index })}>正解にする</button>
                    {editing.choices.length > 2 && <button className="delete-choice-button" type="button" onClick={() => {
                      const choices = editing.choices.filter((_, choiceIndex) => choiceIndex !== index);
                      const answerIndex = editing.answerIndex === index ? 0 : editing.answerIndex > index ? editing.answerIndex - 1 : editing.answerIndex;
                      setEditing({ ...editing, choices, answerIndex });
                    }}>削除</button>}
                  </div>
                </label>
              ))}
              {editing.choices.length < 8 && <button className="inline-add-button" type="button" onClick={() => setEditing({ ...editing, choices: [...editing.choices, ''] })}>＋ 選択肢を追加</button>}
            </div>
            <label className="form-item"><span>解説</span><textarea value={editing.explanation} onChange={(event) => setEditing({ ...editing, explanation: event.target.value })} /></label>
            <label className="form-item"><span>出典（任意）</span><input value={editing.source ?? ''} onChange={(event) => setEditing({ ...editing, source: event.target.value })} /></label>
            <label className="form-item"><span>タグ（任意）</span><input value={tagText} onChange={(event) => setTagText(event.target.value)} placeholder="カンマ区切り" /></label>
            <label className="form-item"><span>出題ウェイト</span><input type="number" min="0.1" step="0.1" value={editing.weight} onChange={(event) => setEditing({ ...editing, weight: Number(event.target.value) })} /></label>
            <label className="form-item"><span>難易度</span><input type="number" min="1" max="5" value={editing.difficulty} onChange={(event) => setEditing({ ...editing, difficulty: Number(event.target.value) })} /></label>
          </div>
          {error && <div className="error-box" role="alert">{error}</div>}
          <button className="primary-button" type="button" onClick={save}>保存</button>
          <button className="secondary-button" type="button" onClick={() => setEditing(null)}>キャンセル</button>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="home-card question-admin-card">
        <h1>問題管理</h1>
        <div className="question-toolbar">
          <input aria-label="問題を検索" placeholder="問題文・ID・タグ・出典を検索" value={search} onChange={(event) => setSearch(event.target.value)} />
          <select aria-label="カテゴリ" value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item} value={item}>{item === 'ALL' ? '全カテゴリ' : item}</option>)}</select>
          <select aria-label="タグ" value={tag} onChange={(event) => setTag(event.target.value)}>{tags.map((item) => <option key={item} value={item}>{item === 'ALL' ? '全タグ' : item}</option>)}</select>
          <select aria-label="ウェイト" value={weight} onChange={(event) => setWeight(event.target.value as WeightFilter)}><option value="ALL">全ウェイト</option><option value="HIGH">重要（3以上）</option><option value="STANDARD">標準（3未満）</option></select>
        </div>
        <div className="question-count" aria-live="polite">{filtered.length} / {questions.length}件</div>
        <div className="question-list">
          {filtered.map((question) => (
            <article key={question.id} className="question-item">
              <div>
                <span>{question.category}{question.subcategory ? ` / ${question.subcategory}` : ''}</span>
                <strong>{question.text}</strong>
                <small>{question.id}・ウェイト {question.weight}・難易度 {question.difficulty}・{getMasteryLabel(questionStates.find((state) => state.questionId === question.id)?.masteryLevel ?? 'UNLEARNED')}</small>
                {(question.tags?.length ?? 0) > 0 && <div className="tag-list">{question.tags?.map((item) => <b key={item}>{item}</b>)}</div>}
              </div>
              <div className="question-actions"><button type="button" onClick={() => startEdit(question)}>編集</button><button className="delete-button" type="button" onClick={() => remove(question.id)}>削除</button></div>
            </article>
          ))}
          {filtered.length === 0 && <div className="empty-state">条件に一致する問題がありません。</div>}
        </div>
        <button className="primary-button" type="button" onClick={startNew}>新しい問題を登録</button>
        <button className="secondary-button" type="button" onClick={onImport}>CSVから一括登録</button>
        <button className="secondary-button" type="button" onClick={onBack}>前のメニューへ戻る</button>
      </section>
    </main>
  );
}
