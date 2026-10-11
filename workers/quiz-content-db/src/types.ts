export type QuestionType = "single" | "multiple" | "text";

export interface Question {
  id: string;
  examScopeId: string;
  category: string;
  subcategory?: string;
  text: string;
  questionType?: QuestionType;
  choices: string[];
  answerIndex: number;
  answerIndices?: number[];
  acceptedAnswers?: string[];
  explanation: string;
  source?: string;
  tags?: string[];
  weight: number;
  difficulty: number;
  archivedAt?: string;
}

export interface ContentChange {
  datasetId: string;
  operation: "add" | "update" | "archive";
  questionId: string;
  baseFingerprint?: string;
  changedFields: string[];
  before?: Question;
  after: Question;
}

export interface ApplyCommand {
  schemaVersion: 1;
  baseContentVersion: string;
  baseDatasetVersions: Record<string, number>;
  changes: ContentChange[];
  message: string;
  idempotencyKey: string;
}

export interface ApplyResult {
  contentVersion: string;
  datasetVersions: Record<string, number>;
  appliedCount: number;
  reused: boolean;
  updatedAt: string;
}

export interface AccessIdentity {
  email: string;
  subject: string;
}

export interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  meta: { changes?: number; [key: string]: unknown };
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run<T = unknown>(): Promise<D1Result<T>>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

export interface WorkerEnv {
  DB: D1Database;
  ALLOWED_ORIGIN: string;
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_AUD: string;
  ALLOWED_EMAILS: string;
  ALLOW_LOCAL_WRITE?: string;
}
