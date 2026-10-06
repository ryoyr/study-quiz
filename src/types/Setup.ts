import { LPIC101_EXAM_SCOPE_ID } from "./ExamScope";

export type ThemePreference = "system" | "light" | "dark";
/** 画面の明暗とは独立して選択する配色・質感テーマ。 */
export type VisualTheme = "aurora" | "focus" | "forest" | "sunset" | "mono";
export type MasteryFilter = "ALL" | "UNLEARNED" | "LEARNING" | "MASTERED";
export type QuestionMode = "ADAPTIVE" | "NEW" | "REVIEW" | "WEAK" | "ALL";

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
  /** 出題対象の上位試験枠。 */
  examScopeId: string;
  /** 旧版互換用の単一トピック。複数選択時はALLを保持する。 */
  defaultCategory: string;
  /** 複数選択した初期トピック。ALLのみの場合は試験枠全体。 */
  defaultCategories: string[];
  /** 旧版互換用の単一理解度。複数選択時はALLを保持する。 */
  defaultMasteryFilter: MasteryFilter;
  /** 複数選択した初期理解度。ALLは単独で保持する。 */
  defaultMasteryFilters: MasteryFilter[];
  /** 旧版互換用の単一出題方法。複数選択時はADAPTIVEを保持する。 */
  defaultQuestionMode: QuestionMode;
  /** 複数選択した初期出題方法。ALLは単独で保持する。 */
  defaultQuestionModes: QuestionMode[];
  /** 個別指定する既定問題。空配列はフィルター一致全体。 */
  defaultQuestionIds: string[];
  /** OS連動・ライト・ダークの明暗設定。 */
  theme: ThemePreference;
  /** UI全体の配色と質感。明暗設定とは独立して保持する。 */
  visualTheme: VisualTheme;
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
    examScopeId: LPIC101_EXAM_SCOPE_ID,
    defaultCategory: "ALL",
    defaultCategories: ["ALL"],
    defaultMasteryFilter: "ALL",
    defaultMasteryFilters: ["ALL"],
    defaultQuestionMode: "ADAPTIVE",
    defaultQuestionModes: ["ADAPTIVE"],
    defaultQuestionIds: [],
    theme: "system",
    visualTheme: "aurora",
    setupCompleted: false,
    createdAt: now,
    updatedAt: now,
  };
};

