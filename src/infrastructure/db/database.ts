const DATABASE_NAME = "study-quiz";
const DATABASE_VERSION = 1;

export const EXAM_ID = "linuc101";

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
  createdAt: string;
  updatedAt: string;
}

export interface ReservedDateRecord {
  examId: string;
  date: string;
}

export interface SettingRecord {
  key: string;
  value: string;
}

export interface InitialSetupRecords {
  exam: ExamRecord;
  reservedDates: ReservedDateRecord[];
  setupCompleted: boolean;
}

let databasePromise: Promise<IDBDatabase> | null = null;

const requestToPromise = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result), {
      once: true,
    });
    request.addEventListener(
      "error",
      () =>
        reject(request.error ?? new Error("IndexedDBの操作に失敗しました。")),
      { once: true },
    );
  });

const transactionToPromise = (transaction: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve(), { once: true });
    transaction.addEventListener(
      "abort",
      () =>
        reject(
          transaction.error ??
            new Error("IndexedDBトランザクションが中断されました。"),
        ),
      { once: true },
    );
    transaction.addEventListener(
      "error",
      () =>
        reject(
          transaction.error ??
            new Error("IndexedDBトランザクションに失敗しました。"),
        ),
      { once: true },
    );
  });

export const openDatabase = (): Promise<IDBDatabase> => {
  if (databasePromise) return databasePromise;
  if (!("indexedDB" in globalThis)) {
    return Promise.reject(
      new Error("このブラウザではIndexedDBを利用できません。"),
    );
  }

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
        const days = database.createObjectStore("days", {
          keyPath: ["examId", "date"],
        });
        days.createIndex("date", "date");
      }
      if (!database.objectStoreNames.contains("settings")) {
        database.createObjectStore("settings", { keyPath: "key" });
      }
    });

    request.addEventListener("success", () => {
      const database = request.result;
      database.addEventListener("versionchange", () => database.close());
      resolve(database);
    });
    request.addEventListener("blocked", () => {
      databasePromise = null;
      reject(
        new Error(
          "別タブで旧バージョンが開かれているため、データベースを更新できません。",
        ),
      );
    });
    request.addEventListener("error", () => {
      databasePromise = null;
      reject(request.error ?? new Error("IndexedDBを開けませんでした。"));
    });
  });

  return databasePromise;
};

export const readInitialSetupRecords =
  async (): Promise<InitialSetupRecords | null> => {
    const database = await openDatabase();
    const transaction = database.transaction(
      ["exams", "days", "settings"],
      "readonly",
    );
    const completion = transactionToPromise(transaction);
    const examRequest = transaction
      .objectStore("exams")
      .get(EXAM_ID) as IDBRequest<ExamRecord | undefined>;
    const daysRequest = transaction.objectStore("days").getAll() as IDBRequest<
      ReservedDateRecord[]
    >;
    const settingRequest = transaction
      .objectStore("settings")
      .get("setup") as IDBRequest<SettingRecord | undefined>;

    const [exam, allDays, setupSetting] = await Promise.all([
      requestToPromise(examRequest),
      requestToPromise(daysRequest),
      requestToPromise(settingRequest),
    ]);
    await completion;

    if (!exam) return null;
    return {
      exam,
      reservedDates: allDays
        .filter((item) => item.examId === EXAM_ID)
        .sort((left, right) => left.date.localeCompare(right.date)),
      setupCompleted: setupSetting?.value === "true",
    };
  };

export const writeInitialSetupRecords = async (
  records: InitialSetupRecords,
): Promise<void> => {
  const database = await openDatabase();
  const transaction = database.transaction(
    ["exams", "days", "settings"],
    "readwrite",
  );
  const completion = transactionToPromise(transaction);

  try {
    transaction.objectStore("exams").put(records.exam);
    const days = transaction.objectStore("days");
    days.clear();
    records.reservedDates.forEach((item) => days.put(item));
    transaction.objectStore("settings").put({
      key: "setup",
      value: records.setupCompleted ? "true" : "false",
    } satisfies SettingRecord);
    await completion;
  } catch (error) {
    try {
      transaction.abort();
    } catch {
      // 既に自動中断またはコミット済みの場合は、元の例外を優先する。
    }
    throw error;
  }
};

export const clearInitialSetupRecords = async (): Promise<void> => {
  const database = await openDatabase();
  const transaction = database.transaction(
    ["exams", "days", "settings"],
    "readwrite",
  );
  const completion = transactionToPromise(transaction);
  transaction.objectStore("exams").delete(EXAM_ID);
  transaction.objectStore("days").clear();
  transaction.objectStore("settings").delete("setup");
  await completion;
};
