import assert from "node:assert/strict";
import test from "node:test";
import {
  differenceInCalendarDays,
  formatLocalDate,
  isValidLocalDate,
  parseLocalDate,
} from "../src/services/localDateService.ts";
import { getRemainingDays } from "../src/services/setupStorage.ts";

test("ローカル日付はうるう日を含めて厳密に検証する", () => {
  assert.equal(isValidLocalDate("2028-02-29"), true);
  assert.equal(isValidLocalDate("2027-02-29"), false);
  assert.equal(isValidLocalDate("2026-13-01"), false);
  assert.equal(isValidLocalDate("2026-1-01"), false);
  assert.equal(parseLocalDate("invalid"), null);
});

test("ローカル日付をYYYY-MM-DDへ往復変換する", () => {
  const date = new Date(0);
  date.setHours(0, 0, 0, 0);
  date.setFullYear(2026, 9, 6);
  assert.equal(formatLocalDate(date), "2026-10-06");
  assert.equal(formatLocalDate(parseLocalDate("2026-10-06")!), "2026-10-06");
});

test("残日数は時刻に依存せず暦日単位で計算する", () => {
  const lateAtNight = new Date(2026, 9, 6, 23, 59, 59);
  assert.equal(differenceInCalendarDays("2026-10-06", lateAtNight), 0);
  assert.equal(differenceInCalendarDays("2026-10-07", lateAtNight), 1);
  assert.equal(getRemainingDays("2026-10-10", lateAtNight), 4);
});

test("年末・月末をまたぐ日数差を正しく計算する", () => {
  assert.equal(
    differenceInCalendarDays("2027-01-02", new Date(2026, 11, 30, 12)),
    3,
  );
  assert.equal(
    differenceInCalendarDays("2028-03-01", new Date(2028, 1, 28, 12)),
    2,
  );
});

