import type { Question } from "../types/Question";

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

const REQUIRED = ["id", "category", "text", "choice1", "choice2", "answer"];
const OPTIONAL = [
  "subcategory",
  "choice3",
  "choice4",
  "choice5",
  "choice6",
  "choice7",
  "choice8",
  "explanation",
  "source",
  "tags",
  "weight",
  "difficulty",
];
const MAX_ROWS = 20_000;
const MAX_ID_LENGTH = 200;
const MAX_SHORT_TEXT_LENGTH = 500;
const MAX_LONG_TEXT_LENGTH = 20_000;

const parseMatrix = (source: string): string[][] => {
  const text = source.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") {
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
const parseTags = (value: string): string[] => [
  ...new Set(
    value
      .split(/[|、]/)
      .map((tag) => tag.trim())
      .filter(Boolean),
  ),
];

export const parseQuestionCsv = (
  text: string,
  existing: Question[],
): CsvParseResult => {
  let matrix: string[][];
  try {
    matrix = parseMatrix(text);
  } catch (error) {
    return {
      headers: [],
      rows: [],
      fatalErrors: [
        error instanceof Error ? error.message : "CSV解析に失敗しました。",
      ],
      validCount: 0,
      warningCount: 0,
      errorCount: 0,
    };
  }
  if (matrix.length === 0)
    return {
      headers: [],
      rows: [],
      fatalErrors: ["CSVにデータがありません。"],
      validCount: 0,
      warningCount: 0,
      errorCount: 0,
    };
  if (matrix.length - 1 > MAX_ROWS)
    return {
      headers: [],
      rows: [],
      fatalErrors: [
        `CSVは${MAX_ROWS.toLocaleString()}件以下に分割してください。`,
      ],
      validCount: 0,
      warningCount: 0,
      errorCount: 0,
    };

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
    const category = get("category");
    const textValue = get("text");
    const choices = Array.from({ length: 8 }, (_, index) =>
      get(`choice${index + 1}`),
    ).filter(Boolean);
    const answer = Number(get("answer"));
    const weight = numberValue(get("weight"), 1);
    const difficulty = numberValue(get("difficulty"), 1);
    if (values.length !== headers.length)
      errors.push(
        `列数が不一致です。期待${headers.length}列、実際${values.length}列。`,
      );
    if (!id) errors.push("idは必須です。");
    else if (id.length > MAX_ID_LENGTH)
      errors.push(`idは${MAX_ID_LENGTH}文字以内です。`);
    if (!category) errors.push("categoryは必須です。");
    else if (category.length > MAX_SHORT_TEXT_LENGTH)
      errors.push(`categoryは${MAX_SHORT_TEXT_LENGTH}文字以内です。`);
    if (!textValue) errors.push("textは必須です。");
    else if (textValue.length > MAX_LONG_TEXT_LENGTH)
      errors.push(
        `textは${MAX_LONG_TEXT_LENGTH.toLocaleString()}文字以内です。`,
      );
    if (choices.length < 2) errors.push("選択肢は2件以上必要です。");
    if (choices.some((choice) => choice.length > MAX_LONG_TEXT_LENGTH))
      errors.push(
        `選択肢は各${MAX_LONG_TEXT_LENGTH.toLocaleString()}文字以内です。`,
      );
    if (!Number.isInteger(answer) || answer < 1 || answer > choices.length)
      errors.push("answerは存在する選択肢番号（1開始）で指定してください。");
    if (!Number.isFinite(weight) || weight <= 0)
      errors.push("weightは0より大きい数値です。");
    if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5)
      errors.push("difficultyは1～5の整数です。");
    if (existingIds.has(id)) errors.push("既存の問題IDと重複しています。");
    if (csvIds.has(id)) errors.push("CSV内で問題IDが重複しています。");
    if (id) csvIds.add(id);
    if (!get("explanation")) warnings.push("解説が未入力です。");
    if (!get("source")) warnings.push("出典が未入力です。");
    const messages = [...errors, ...warnings];
    const status: CsvRowStatus = errors.length
      ? "error"
      : warnings.length
        ? "warning"
        : "valid";
    const question: Question | null = errors.length
      ? null
      : {
          id,
          category,
          subcategory: get("subcategory") || undefined,
          text: textValue,
          choices,
          answerIndex: answer - 1,
          explanation: get("explanation"),
          source: get("source") || undefined,
          tags: parseTags(get("tags")),
          weight,
          difficulty,
        };
    return { rowNumber: offset + 2, status, messages, question };
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
export const CSV_TEMPLATE =
  "id,category,subcategory,text,choice1,choice2,choice3,choice4,answer,explanation,source,tags,weight,difficulty\nLINUX-001,Linux,基本コマンド,lsコマンドの用途は？,一覧表示,削除,移動,圧縮,1,ディレクトリの内容を一覧表示します。,公式マニュアル,コマンド|基本,3,2\n";
