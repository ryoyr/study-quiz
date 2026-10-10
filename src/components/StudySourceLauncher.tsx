import { useMemo } from "react";
import type { Question } from "../types/Question";
import type { StudySessionItem, SourceType } from "../types/StudySession";
type Props = {
  items: StudySessionItem[];
  onStart: (questions: Question[]) => void;
};
type Definition = {
  source: SourceType;
  label: string;
  description: string;
  className: string;
};
const DEFINITIONS: Definition[] = [
  {
    source: "NEW",
    label: "新規だけ学習",
    description: "まだ回答していない問題",
    className: "source-new",
  },
  {
    source: "REVIEW",
    label: "復習だけ学習",
    description: "FSRSの復習期限を迎えた問題",
    className: "source-review",
  },
  {
    source: "WEAK",
    label: "弱点だけ学習",
    description: "正答率や回答速度から判定した問題",
    className: "source-weak",
  },
  {
    source: "CUSTOM",
    label: "指定問題を学習",
    description: "条件または個別指定で選んだ問題",
    className: "source-custom",
  },
];
export default function StudySourceLauncher({ items, onStart }: Props) {
  const groups = useMemo(
    () =>
      new Map(
        DEFINITIONS.map(({ source }) => [
          source,
          items
            .filter((item) => item.sourceTypes.includes(source))
            .map((item) => item.question)
            .filter(
              (question, index, array) =>
                array.findIndex((candidate) => candidate.id === question.id) ===
                index,
            ),
        ]),
      ),
    [items],
  );
  return (
    <section className="study-source-launcher">
      <div className="study-source-title">
        <span>学習種別を選択</span>
        <small>同じ問題が複数種別に含まれる場合があります</small>
      </div>
      <div className="study-source-grid">
        {DEFINITIONS.map((definition) => {
          const questions = groups.get(definition.source) ?? [];
          return (
            <article key={definition.source} className={definition.className}>
              <span>{definition.description}</span>
              <strong>{questions.length}問</strong>
              <button
                type="button"
                disabled={questions.length === 0}
                onClick={() => onStart(questions)}
              >
                {definition.label}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
