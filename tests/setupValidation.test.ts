import assert from "node:assert/strict";
import test from "node:test";
import { validateSetup } from "../src/services/setupValidation.ts";
import type { Setup } from "../src/types/Setup.ts";

const validSetup = (): Setup => ({
  name: "LinuC 101",
  examDate: "2026-12-03",
  dailyNewLimit: 10,
  dailyQuestionLimit: 20,
  bufferRate: 20,
  instantThresholdSeconds: 30,
  dailyMinimumQuestions: 15,
  reservedDates: ["2026-10-10"],
  setupCompleted: true,
  createdAt: "2026-10-04T00:00:00.000Z",
  updatedAt: "2026-10-04T00:00:00.000Z",
});
const now = new Date("2026-10-04T13:10:04.000Z");

test("正常な初回設定を受け付ける", () => {
  assert.deepEqual(validateSetup(validSetup(), now), {});
});

test("総問題数上限が新規上限未満の場合は拒否する", () => {
  const setup = { ...validSetup(), dailyNewLimit: 30, dailyQuestionLimit: 20 };
  assert.equal(
    validateSetup(setup, now).dailyQuestionLimit,
    "新規問題上限以上、1000以下の整数で指定してください。",
  );
});

test("存在しないカレンダー日付を拒否する", () => {
  const setup = { ...validSetup(), examDate: "2026-02-30" };
  assert.equal(
    validateSetup(setup, now).examDate,
    "正しい試験日を入力してください。",
  );
});

test("予約日の重複を拒否する", () => {
  const setup = {
    ...validSetup(),
    reservedDates: ["2026-10-10", "2026-10-10"],
  };
  assert.equal(
    validateSetup(setup, now).reservedDates,
    "学習しない日が重複しています。",
  );
});

test("試験日当日の予約日を拒否する", () => {
  const setup = { ...validSetup(), reservedDates: ["2026-12-03"] };
  assert.equal(
    validateSetup(setup, now).reservedDates,
    "学習しない日は本日から試験日前日までです。",
  );
});
