import type { Question, QuestionType } from "../types/Question";
import { LPIC101_EXAM_SCOPE_ID } from "../types/ExamScope";
import {
  QUESTION_LIMITS,
  questionValidationErrors,
} from "./questionValidation.ts";

export type CsvRowStatus = "valid" | "warning" | "error";
export interface CsvPreviewRow {
  rowNumber: number;
  status: CsvRowStatus;
  messages: string[];
  question: Question | null;
}
export interface CsvParseResult {
  headers: string[];
  rows: CsvPreviewRow[];
  fatalErrors: string[];
  validCount: number;
  warningCount: number;
  errorCount: number;
}

const REQUIRED = ["id", "category", "text"];
const OPTIONAL = [
  "examScopeId",
  "subcategory",
  "questionType",
  "choice1",
  "choice2",
  "choice3",
  "choice4",
  "choice5",
  "choice6",
  "choice7",
  "choice8",
  "answer",
  "answers",
  "acceptedAnswers",
  "explanation",
  "source",
  "tags",
  "weight",
  "difficulty",
];
const MAX_ROWS = 20_000;
const MAX_CSV_CHARS = 5 * 1024 * 1024;

const parseMatrix = (source: string): string[][] => {
  const text = source.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let closedQuote = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
        closedQuote = true;
      }
      else field += character;
    } else if (closedQuote) {
      if (character === ",") {
        row.push(field);
        field = "";
        closedQuote = false;
      } else if (character === "\r" || character === "\n") {
        if (character === "\r" && text[index + 1] === "\n") index += 1;
        row.push(field);
        if (row.some((value) => value !== "")) rows.push(row);
        row = [];
        field = "";
        closedQuote = false;
      } else {
        throw new Error("引用符で閉じたフィールドの後に余計な文字があります。");
      }
    } else if (character === '"') {
      if (field.length > 0)
        throw new Error("引用符はフィールドの先頭で使用してください。");
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\r" || character === "\n") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      field = "";
    } else field += character;
  }
  if (quoted) throw new Error("ダブルクォートが閉じられていません。");
  row.push(field);
  if (row.some((value) => value !== "")) rows.push(row);
  return rows;
};

const numberValue = (value: string, fallback: number) =>
  value.trim() === "" ? fallback : Number(value);

const splitList = (value: string): string[] =>
  value
    .split(/[|、]/)
    .map((item) => item.trim())
    .filter(Boolean);

const parseList = (value: string): string[] => [...new Set(splitList(value))];

const parseQuestionType = (value: string): QuestionType | null => {
  const normalized = value.trim() || "single";
  return ["single", "multiple", "text"].includes(normalized)
    ? (normalized as QuestionType)
    : null;
};

const emptyResult = (message: string): CsvParseResult => ({
  headers: [],
  rows: [],
  fatalErrors: [message],
  validCount: 0,
  warningCount: 0,
  errorCount: 0,
});

export const parseQuestionCsv = (
  text: string,
  existing: Question[],
): CsvParseResult => {
  if (text.length > MAX_CSV_CHARS) {
    return emptyResult("CSVファイルは5MB以下にしてください。");
  }
  let matrix: string[][];
  try {
    matrix = parseMatrix(text);
  } catch (error) {
    return emptyResult(
      error instanceof Error ? error.message : "CSV解析に失敗しました。",
    );
  }
  if (matrix.length === 0) return emptyResult("CSVにデータがありません。");
  if (matrix.length - 1 > MAX_ROWS)
    return emptyResult(
      `CSVは${MAX_ROWS.toLocaleString()}件以下に分割してください。`,
    );

  const headers = matrix[0].map((value) => value.trim());
  const duplicateHeaders = headers.filter(
    (header, index) => headers.indexOf(header) !== index,
  );
  const missing = REQUIRED.filter((header) => !headers.includes(header));
  const unknown = headers.filter(
    (header) => ![...REQUIRED, ...OPTIONAL].includes(header),
  );
  const fatalErrors: string[] = [];
  if (missing.length)
    fatalErrors.push(`必須列が不足しています: ${missing.join(", ")}`);
  if (duplicateHeaders.length)
    fatalErrors.push(
      `ヘッダーが重複しています: ${[...new Set(duplicateHeaders)].join(", ")}`,
    );
  if (unknown.length)
    fatalErrors.push(`未対応の列があります: ${unknown.join(", ")}`);
  if (fatalErrors.length)
    return {
      headers,
      rows: [],
      fatalErrors,
      validCount: 0,
      warningCount: 0,
      errorCount: 0,
    };

  const headerIndex = Object.fromEntries(
    headers.map((header, index) => [header, index]),
  );
  const existingIds = new Set(existing.map((question) => question.id));
  const csvIds = new Set<string>();
  const rows = matrix.slice(1).map((values, offset): CsvPreviewRow => {
    const get = (name: string) => values[headerIndex[name]]?.trim() ?? "";
    const errors: string[] = [];
    const warnings: string[] = [];
    const id = get("id");
    const examScopeId = get("examScopeId") || LPIC101_EXAM_SCOPE_ID;
    const category = get("category");
    const subcategory = get("subcategory");
    const textValue = get("text");
    const questionType = parseQuestionType(get("questionType"));
    const choices = Array.from({ length: QUESTION_LIMITS.maxChoices }, (_, index) =>
      get(`choice${index + 1}`),
    ).filter(Boolean);
    const weight = numberValue(get("weight"), 1);
    const difficulty = numberValue(get("difficulty"), 1);
    const tags = parseList(get("tags"));
    const acceptedAnswers = parseList(get("acceptedAnswers"));
    const answerNumbers = splitList(get("answers")).map(Number);
    const singleAnswer = Number(get("answer"));

    if (values.length !== headers.length)
      errors.push(
        `列数が不一致です。期待${headers.length}列、実際${values.length}列。`,
      );
    if (!questionType)
      errors.push("questionTypeはsingle、multiple、textのいずれかです。");
    if (existingIds.has(id)) errors.push("既存の問題IDと重複しています。");
    if (csvIds.has(id)) errors.push("CSV内で問題IDが重複しています。");
    if (id) csvIds.add(id);

    let answerIndex = 0;
    let answerIndices: number[] | undefined;
    if (questionType === "single") {
      answerIndex = singleAnswer - 1;
      if (
        !Number.isInteger(singleAnswer) ||
        singleAnswer < 1 ||
        singleAnswer > choices.length
      )
        errors.push("singleのanswerは存在する選択肢番号（1開始）で指定してください。");
    } else if (questionType === "multiple") {
      if (
        answerNumbers.length === 0 ||
        answerNumbers.some(
          (answer) =>
            !Number.isInteger(answer) || answer < 1 || answer > choices.length,
        ) ||
        new Set(answerNumbers).size !== answerNumbers.length
      ) {
        errors.push(
          "multipleのanswersは重複のない選択肢番号（1開始）を|区切りで指定してください。",
        );
      } else {
        answerIndices = answerNumbers.map((answer) => answer - 1).sort((a, b) => a - b);
        answerIndex = answerIndices[0] ?? 0;
      }
    } else if (questionType === "text" && acceptedAnswers.length === 0) {
      errors.push("textのacceptedAnswersは許容回答を|区切りで1件以上指定してください。");
    }

    const candidate: Question = {
      id,
      examScopeId,
      category,
      subcategory: subcategory || undefined,
      text: textValue,
      questionType: questionType ?? "single",
      choices: questionType === "text" ? [] : choices,
      answerIndex,
      ...(questionType === "multiple" ? { answerIndices } : {}),
      ...(questionType === "text" ? { acceptedAnswers } : {}),
      explanation: get("explanation"),
      source: get("source") || undefined,
      tags,
      weight,
      difficulty,
    };

    for (const validationError of questionValidationErrors(candidate)) {
      if (!errors.includes(validationError)) errors.push(validationError);
    }
    if (!get("explanation")) warnings.push("解説が未入力です。");
    if (!get("source")) warnings.push("出典が未入力です。");

    const messages = [...errors, ...warnings];
    const status: CsvRowStatus = errors.length
      ? "error"
      : warnings.length
        ? "warning"
        : "valid";
    return {
      rowNumber: offset + 2,
      status,
      messages,
      question: errors.length ? null : candidate,
    };
  });
  return {
    headers,
    rows,
    fatalErrors,
    validCount: rows.filter((row) => row.status === "valid").length,
    warningCount: rows.filter((row) => row.status === "warning").length,
    errorCount: rows.filter((row) => row.status === "error").length,
  };
};

export const questionsFromPreview = (result: CsvParseResult): Question[] =>
  result.rows
    .filter((row) => row.question !== null)
    .map((row) => row.question as Question);

const CSV_COLUMNS = [
  "id",
  "examScopeId",
  "category",
  "subcategory",
  "text",
  "questionType",
  "choice1",
  "choice2",
  "choice3",
  "choice4",
  "choice5",
  "choice6",
  "choice7",
  "choice8",
  "answer",
  "answers",
  "acceptedAnswers",
  "explanation",
  "source",
  "tags",
  "weight",
  "difficulty",
];

export const CSV_TEMPLATE = [
  CSV_COLUMNS,
  [
    "LPIC101-CSV-001", "lpic101", "103 GNUとUNIXコマンド", "103.1 コマンドライン",
    "lsコマンドの用途は？", "single", "一覧表示", "削除", "移動", "圧縮",
    "", "", "", "", "1", "", "", "ディレクトリの内容を一覧表示します。",
    "LPI 101-500 Objectives", "LPIC-1|101-500|103.1", "3", "2",
  ],
  [
    "LPIC101-CSV-002", "lpic101", "103 GNUとUNIXコマンド", "103.2 フィルター",
    "標準入力を扱えるコマンドをすべて選択してください。", "multiple", "grep", "sed", "pwd", "awk",
    "", "", "", "", "", "1|2|4", "", "grep、sed、awkは標準入力を処理できます。",
    "LPI 101-500 Objectives", "LPIC-1|101-500|103.2", "3", "3",
  ],
  [
    "LPIC101-CSV-003", "lpic101", "102 Linuxのインストール", "102.1 ハードディスク設計",
    "論理ボリューム管理の略称を入力してください。", "text", "", "", "", "",
    "", "", "", "", "", "", "LVM|lvm", "Logical Volume Managerの略称です。",
    "LPI 101-500 Objectives", "LPIC-1|101-500|102.1", "2", "2",
  ],
].map((row) => row.join(",")).join("\n") + "\n";
