export interface Setup {
  name: string;
  examDate: string;
  dailyNewLimit: number;
  dailyQuestionLimit: number;
  bufferRate: number;
  instantThresholdSeconds: number;
  dailyMinimumQuestions: number;
  reservedDates: string[];
  /** 0=日曜 ... 6=土曜。個別日付とは別に毎週の非学習日を保持する。 */
  reservedWeekdays?: number[];
  setupCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

const localDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const createDefaultSetup = (): Setup => {
  const examDate = new Date();
  examDate.setDate(examDate.getDate() + 60);
  const now = new Date().toISOString();
  return {
    name: "LPIC-1 101",
    examDate: localDate(examDate),
    dailyNewLimit: 10,
    dailyQuestionLimit: 20,
    bufferRate: 20,
    instantThresholdSeconds: 30,
    dailyMinimumQuestions: 15,
    reservedDates: [],
    reservedWeekdays: [],
    setupCompleted: false,
    createdAt: now,
    updatedAt: now,
  };
};
