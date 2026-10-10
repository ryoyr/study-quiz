import type { Question } from "./Question";

export interface QuestionMasterDatasetDescriptor {
  id: string;
  version: number;
  path: string;
  questionCount: number;
}

export interface QuestionMasterManifest {
  schemaVersion: 1;
  contentVersion: string;
  updatedAt: string;
  datasets: QuestionMasterDatasetDescriptor[];
}

export interface QuestionMasterDataset {
  schemaVersion: 1;
  datasetId: string;
  version: number;
  questions: Question[];
}

export interface QuestionMasterSnapshot {
  manifest: QuestionMasterManifest;
  datasets: QuestionMasterDataset[];
  questions: Question[];
}

export interface ContentPullRequestState {
  number: number;
  url: string;
  branch: string;
  state: "open" | "closed" | "merged";
  updatedAt: string;
}

export interface QuestionMasterSyncState {
  schemaVersion: 1;
  contentVersion: string;
  datasetVersions: Record<string, number>;
  questionFingerprints: Record<string, string>;
  checkedAt: string;
  lastPullRequest?: ContentPullRequestState;
}

export type QuestionMasterMergeActionKind = "add" | "update" | "archive";

export interface QuestionMasterMergeAction {
  kind: QuestionMasterMergeActionKind;
  questionId: string;
  before?: Question;
  after: Question;
}

export interface QuestionMasterMergeConflict {
  questionId: string;
  reason:
    | "LOCAL_AND_REMOTE_CHANGED"
    | "LOCAL_CHANGED_REMOTE_REMOVED"
    | "UNTRACKED_ID_COLLISION";
  local: Question;
  remote?: Question;
}

export interface QuestionMasterMergePlan {
  actions: QuestionMasterMergeAction[];
  conflicts: QuestionMasterMergeConflict[];
  unchangedCount: number;
  nextState: QuestionMasterSyncState;
}

export type QuestionMasterChangeOperation = "add" | "update" | "archive";

export interface QuestionMasterChange {
  datasetId: string;
  operation: QuestionMasterChangeOperation;
  questionId: string;
  baseFingerprint?: string;
  changedFields: string[];
  before?: Question;
  after: Question;
}

export interface CreateContentPullRequestCommand {
  schemaVersion: 1;
  baseContentVersion: string;
  baseDatasetVersions: Record<string, number>;
  changes: QuestionMasterChange[];
  title: string;
  body: string;
  commitMessage: string;
  idempotencyKey: string;
}

export interface CreateContentPullRequestResult {
  number: number;
  url: string;
  branch: string;
  state: "open" | "closed" | "merged";
  reused: boolean;
}

export interface ContentApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    action?: string;
  };
}
