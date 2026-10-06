import { defaultExamScopes } from "../../data/examScopes";
import { LPIC101_EXAM_SCOPE_ID, type ExamScope } from "../../types/ExamScope";
import type { MasteryFilter, QuestionMode, ThemePreference, VisualTheme } from "../../types/Setup";

const DATABASE_NAME = "study-quiz";
const DATABASE_VERSION = 2;

export const EXAM_ID = LPIC101_EXAM_SCOPE_ID;
const LEGACY_EXAM_ID = "linuc101";

export interface ExamRecord {
  id: string;
  name: string;
  examDate: string;
  dailyNewLimit: number;
  dailyQuestionLimit: number;
  /** 0.0～1.0 の小数値。 */
  bufferRate: number;
  instantThresholdSeconds: number;
  dailyMinimumQuestions: number;
  reservedWeekdays?: number[];
  examScopeId?: string;
  defaultCategory?: string;
  defaultCategories?: string[];
  defaultMasteryFilter?: MasteryFilter;
  defaultMasteryFilters?: MasteryFilter[];
  defaultQuestionMode?: QuestionMode;
  defaultQuestionModes?: QuestionMode[];
  defaultQuestionIds?: string[];
  theme?: ThemePreference;
  visualTheme?: VisualTheme;
  createdAt: string;
  updatedAt: string;
}

export interface ReservedDateRecord { examId: string; date: string; }
export interface SettingRecord { key: string; value: string; }
export interface InitialSetupRecords {
  exam: ExamRecord;
  reservedDates: ReservedDateRecord[];
  setupCompleted: boolean;
}

let databasePromise: Promise<IDBDatabase> | null = null;
const requestToPromise = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result), { once: true });
    request.addEventListener("error", () => reject(request.error ?? new Error("IndexedDBの操作に失敗しました。")), { once: true });
  });
const transactionToPromise = (transaction: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve(), { once: true });
    transaction.addEventListener("abort", () => reject(transaction.error ?? new Error("IndexedDBトランザクションが中断されました。")), { once: true });
    transaction.addEventListener("error", () => reject(transaction.error ?? new Error("IndexedDBトランザクションに失敗しました。")), { once: true });
  });

export const openDatabase = (): Promise<IDBDatabase> => {
  if (databasePromise) return databasePromise;
  if (!("indexedDB" in globalThis)) return Promise.reject(new Error("このブラウザではIndexedDBを利用できません。"));
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.addEventListener("upgradeneeded", () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("exams")) {
        const exams = database.createObjectStore("exams", { keyPath: "id" });
        exams.createIndex("name", "name");
        exams.createIndex("examDate", "examDate");
      }
      if (!database.objectStoreNames.contains("days")) {
        const days = database.createObjectStore("days", { keyPath: ["examId", "date"] });
        days.createIndex("date", "date");
      }
      if (!database.objectStoreNames.contains("settings")) database.createObjectStore("settings", { keyPath: "key" });
      if (!database.objectStoreNames.contains("examScopes")) {
        const scopes = database.createObjectStore("examScopes", { keyPath: "id" });
        scopes.createIndex("examCode", "examCode", { unique: true });
        scopes.createIndex("sortOrder", "sortOrder");
        defaultExamScopes.forEach((item) => scopes.put(item));
      }
    });
    request.addEventListener("success", () => {
      const database = request.result;
      database.addEventListener("versionchange", () => {
        databasePromise = null;
        database.close();
      });
      resolve(database);
    });
    request.addEventListener("blocked", () => {
      databasePromise = null;
      reject(new Error("別タブで旧バージョンが開かれているため、データベースを更新できません。"));
    });
    request.addEventListener("error", () => {
      databasePromise = null;
      reject(request.error ?? new Error("IndexedDBを開けませんでした。"));
    });
  });
  return databasePromise;
};

export const readExamScopes = async (): Promise<ExamScope[]> => {
  const database = await openDatabase();
  let transaction = database.transaction("examScopes", "readonly");
  let completion = transactionToPromise(transaction);
  let items = await requestToPromise(transaction.objectStore("examScopes").getAll() as IDBRequest<ExamScope[]>);
  await completion;
  if (items.length === 0) {
    transaction = database.transaction("examScopes", "readwrite");
    completion = transactionToPromise(transaction);
    defaultExamScopes.forEach((item) => transaction.objectStore("examScopes").put(item));
    await completion;
    items = [...defaultExamScopes];
  }
  return items.sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, "ja"));
};

export const readInitialSetupRecords = async (): Promise<InitialSetupRecords | null> => {
  const database = await openDatabase();
  const transaction = database.transaction(["exams", "days", "settings"], "readonly");
  const completion = transactionToPromise(transaction);
  const exams = transaction.objectStore("exams");
  const [currentExam, legacyExam, allDays, setupSetting] = await Promise.all([
    requestToPromise(exams.get(EXAM_ID) as IDBRequest<ExamRecord | undefined>),
    requestToPromise(exams.get(LEGACY_EXAM_ID) as IDBRequest<ExamRecord | undefined>),
    requestToPromise(transaction.objectStore("days").getAll() as IDBRequest<ReservedDateRecord[]>),
    requestToPromise(transaction.objectStore("settings").get("setup") as IDBRequest<SettingRecord | undefined>),
  ]);
  await completion;
  const exam = currentExam ?? legacyExam;
  if (!exam) return null;
  return {
    exam,
    reservedDates: allDays.filter((item) => item.examId === exam.id || item.examId === EXAM_ID || item.examId === LEGACY_EXAM_ID).sort((left, right) => left.date.localeCompare(right.date)),
    setupCompleted: setupSetting?.value === "true",
  };
};

export const writeInitialSetupRecords = async (records: InitialSetupRecords): Promise<void> => {
  const database = await openDatabase();
  const transaction = database.transaction(["exams", "days", "settings"], "readwrite");
  const completion = transactionToPromise(transaction);
  try {
    const exams = transaction.objectStore("exams");
    exams.put({ ...records.exam, id: EXAM_ID, examScopeId: records.exam.examScopeId ?? EXAM_ID });
    exams.delete(LEGACY_EXAM_ID);
    const days = transaction.objectStore("days");
    days.clear();
    records.reservedDates.forEach((item) => days.put({ ...item, examId: EXAM_ID }));
    transaction.objectStore("settings").put({ key: "setup", value: records.setupCompleted ? "true" : "false" } satisfies SettingRecord);
    await completion;
  } catch (error) {
    try { transaction.abort(); } catch { /* 元の例外を優先 */ }
    throw error;
  }
};

export const clearInitialSetupRecords = async (): Promise<void> => {
  const database = await openDatabase();
  const transaction = database.transaction(["exams", "days", "settings"], "readwrite");
  const completion = transactionToPromise(transaction);
  transaction.objectStore("exams").delete(EXAM_ID);
  transaction.objectStore("exams").delete(LEGACY_EXAM_ID);
  transaction.objectStore("days").clear();
  transaction.objectStore("settings").delete("setup");
  await completion;
};
