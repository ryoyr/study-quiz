import { useMemo, useState } from "react";
import {
  normalizeReservedDates,
  normalizeReservedWeekdays,
  parseLocalDate,
  toLocalDate,
} from "../services/reservedDayService";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

type Props = {
  examDate: string;
  reservedDates: string[];
  reservedWeekdays: number[];
  error?: string;
  errorId?: string;
  onChange: (dates: string[], weekdays: number[]) => void;
};

const firstOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

export default function NonStudyDayPicker({
  examDate,
  reservedDates,
  reservedWeekdays,
  error,
  errorId,
  onChange,
}: Props) {
  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);
  const [month, setMonth] = useState(() => firstOfMonth(today));
  const dates = useMemo(() => new Set(normalizeReservedDates(reservedDates)), [reservedDates]);
  const weekdays = useMemo(
    () => new Set(normalizeReservedWeekdays(reservedWeekdays)),
    [reservedWeekdays],
  );
  const exam = parseLocalDate(examDate);

  const cells = useMemo(() => {
    const start = firstOfMonth(month);
    start.setDate(start.getDate() - start.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [month]);

  const selectable = (date: Date) => date >= today && Boolean(exam && date < exam);
  const toggleDate = (date: Date) => {
    if (!selectable(date) || weekdays.has(date.getDay())) return;
    const key = toLocalDate(date);
    const next = new Set(dates);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange([...next].sort(), [...weekdays].sort());
  };
  const toggleWeekday = (weekday: number) => {
    const next = new Set(weekdays);
    if (next.has(weekday)) next.delete(weekday);
    else next.add(weekday);
    onChange([...dates].sort(), [...next].sort());
  };

  const recurringCount = exam
    ? (() => {
        let count = 0;
        const cursor = new Date(today);
        while (cursor < exam && count < 3660) {
          if (weekdays.has(cursor.getDay())) count += 1;
          cursor.setDate(cursor.getDate() + 1);
        }
        return count;
      })()
    : 0;

  return (
    <fieldset className="non-study-picker" aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined}>
      <legend>学習しない日</legend>
      <p>曜日をまとめて指定するか、カレンダーの日付をタップしてください。</p>
      <div className="weekday-picker" aria-label="学習しない曜日">
        {WEEKDAYS.map((label, index) => (
          <button
            key={label}
            type="button"
            aria-pressed={weekdays.has(index)}
            onClick={() => toggleWeekday(index)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="calendar-picker">
        <div className="calendar-heading">
          <button type="button" aria-label="前の月" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button>
          <strong>{month.getFullYear()}年{month.getMonth() + 1}月</strong>
          <button type="button" aria-label="次の月" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button>
        </div>
        <div className="calendar-weekdays" aria-hidden="true">
          {WEEKDAYS.map((label) => <span key={label}>{label}</span>)}
        </div>
        <div className="calendar-days">
          {cells.map((date) => {
            const key = toLocalDate(date);
            const outside = date.getMonth() !== month.getMonth();
            const recurring = weekdays.has(date.getDay()) && selectable(date);
            const selected = dates.has(key) || recurring;
            return (
              <button
                key={key}
                type="button"
                className={[outside ? "is-outside" : "", selected ? "is-selected" : "", recurring ? "is-recurring" : ""].filter(Boolean).join(" ")}
                disabled={!selectable(date)}
                aria-pressed={selected}
                aria-label={`${key}${recurring ? " 曜日指定" : selected ? " 学習しない日" : ""}`}
                onClick={() => toggleDate(date)}
              >
                {date.getDate()}
              </button>
            );
          })}
        </div>
      </div>
      <div className="non-study-summary">
        <span>個別 {dates.size}日</span>
        <span>曜日指定 {weekdays.size}件</span>
        <span>今後の対象 約{recurringCount + dates.size}日</span>
        {(dates.size > 0 || weekdays.size > 0) && (
          <button type="button" onClick={() => onChange([], [])}>すべて解除</button>
        )}
      </div>
      {error && <span id={errorId} className="field-error">{error}</span>}
    </fieldset>
  );
}
