

import type { Setup } from '../../types/Setup';
import {
  clearInitialSetupRecords,
  EXAM_ID,
  readInitialSetupRecords,
  writeInitialSetupRecords,
} from '../db/database';

export const findSetup = async (): Promise<Setup | null> => {
  const records = await readInitialSetupRecords();
  if (!records) return null;

  const { exam } = records;
  return {
    name: exam.name,
    examDate: exam.examDate,
    dailyNewLimit: exam.dailyNewLimit,
    dailyQuestionLimit: exam.dailyQuestionLimit,
    // 画面・ドメイン層は百分率、IndexedDBは設計どおり0.0～1.0で保持する。
    bufferRate: exam.bufferRate * 100,
    instantThresholdSeconds: exam.instantThresholdSeconds,
    dailyMinimumQuestions: exam.dailyMinimumQuestions ?? Math.min(15, exam.dailyQuestionLimit),
    reservedDates: records.reservedDates.map((item) => item.date),
    setupCompleted: records.setupCompleted,
    createdAt: exam.createdAt,
    updatedAt: exam.updatedAt,
  };
};

export const persistSetup = async (setup: Setup): Promise<void> => {
  await writeInitialSetupRecords({
    exam: {
      id: EXAM_ID,
      name: setup.name,
      examDate: setup.examDate,
      dailyNewLimit: setup.dailyNewLimit,
      dailyQuestionLimit: setup.dailyQuestionLimit,
      bufferRate: setup.bufferRate / 100,
      instantThresholdSeconds: setup.instantThresholdSeconds,
      dailyMinimumQuestions: setup.dailyMinimumQuestions,
      createdAt: setup.createdAt,
      updatedAt: setup.updatedAt,
    },
    reservedDates: setup.reservedDates.map((date) => ({ examId: EXAM_ID, date })),
    setupCompleted: setup.setupCompleted,
  });
};

export const removeSetup = clearInitialSetupRecords;
