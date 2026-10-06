import { LPIC101_EXAM_SCOPE_ID } from "../../types/ExamScope";
import type { Setup } from "../../types/Setup";
import { normalizeSetup } from "../../services/setupStorage.ts";
import {
  clearInitialSetupRecords,
  EXAM_ID,
  readInitialSetupRecords,
  writeInitialSetupRecords,
} from "../db/database";

export const findSetup = async (): Promise<Setup | null> => {
  const records = await readInitialSetupRecords();
  if (!records) return null;
  const { exam } = records;
  return normalizeSetup({
    name: exam.name,
    examDate: exam.examDate,
    dailyNewLimit: exam.dailyNewLimit,
    dailyQuestionLimit: exam.dailyQuestionLimit,
    // 画面・ドメイン層は百分率、IndexedDBは0.0～1.0で保持する。
    bufferRate: exam.bufferRate * 100,
    instantThresholdSeconds: exam.instantThresholdSeconds,
    dailyMinimumQuestions: exam.dailyMinimumQuestions ?? Math.min(15, exam.dailyQuestionLimit),
    reservedDates: records.reservedDates.map((item) => item.date),
    reservedWeekdays: Array.isArray(exam.reservedWeekdays) ? exam.reservedWeekdays : [],
    examScopeId: exam.examScopeId ?? LPIC101_EXAM_SCOPE_ID,
    defaultCategory: exam.defaultCategory,
    defaultCategories: exam.defaultCategories,
    defaultMasteryFilter: exam.defaultMasteryFilter,
    defaultMasteryFilters: exam.defaultMasteryFilters,
    defaultQuestionMode: exam.defaultQuestionMode,
    defaultQuestionModes: exam.defaultQuestionModes,
    defaultQuestionIds: exam.defaultQuestionIds,
    theme: exam.theme,
    setupCompleted: records.setupCompleted,
    createdAt: exam.createdAt,
    updatedAt: exam.updatedAt,
  });
};

export const persistSetup = async (setup: Setup): Promise<void> => {
  const normalized = normalizeSetup(setup);
  await writeInitialSetupRecords({
    exam: {
      id: EXAM_ID,
      name: normalized.name,
      examDate: normalized.examDate,
      dailyNewLimit: normalized.dailyNewLimit,
      dailyQuestionLimit: normalized.dailyQuestionLimit,
      bufferRate: normalized.bufferRate / 100,
      instantThresholdSeconds: normalized.instantThresholdSeconds,
      dailyMinimumQuestions: normalized.dailyMinimumQuestions,
      reservedWeekdays: normalized.reservedWeekdays,
      examScopeId: normalized.examScopeId,
      defaultCategory: normalized.defaultCategory,
      defaultCategories: normalized.defaultCategories,
      defaultMasteryFilter: normalized.defaultMasteryFilter,
      defaultMasteryFilters: normalized.defaultMasteryFilters,
      defaultQuestionMode: normalized.defaultQuestionMode,
      defaultQuestionModes: normalized.defaultQuestionModes,
      defaultQuestionIds: normalized.defaultQuestionIds,
      theme: normalized.theme,
      createdAt: normalized.createdAt,
      updatedAt: normalized.updatedAt,
    },
    reservedDates: normalized.reservedDates.map((date) => ({ examId: EXAM_ID, date })),
    setupCompleted: normalized.setupCompleted,
  });
};

export const removeSetup = clearInitialSetupRecords;

