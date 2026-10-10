import type { Question } from "../../../src/types/Question";
import type {
  CreateContentPullRequestCommand,
  CreateContentPullRequestResult,
  QuestionMasterDataset,
  QuestionMasterManifest,
} from "../../../src/types/QuestionMaster";

export interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface WorkerEnv {
  GITHUB_APP_ID: string;
  GITHUB_INSTALLATION_ID: string;
  GITHUB_PRIVATE_KEY: string;
  GITHUB_OWNER: string;
  GITHUB_REPO: string;
  GITHUB_BASE_BRANCH: string;
  GITHUB_CONTENT_ROOT: string;
  ALLOWED_ORIGIN: string;
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_AUD: string;
  ALLOWED_EMAILS: string;
  RATE_LIMITER?: RateLimitBinding;
}

export interface AuthenticatedIdentity {
  email: string;
  subject: string;
}

export interface GitHubPullRequest {
  number: number;
  html_url: string;
  state: "open" | "closed";
  merged_at: string | null;
  head: { ref: string };
}

export interface RepositoryMaster {
  baseCommitSha: string;
  baseTreeSha: string;
  manifest: QuestionMasterManifest;
  datasets: QuestionMasterDataset[];
}

export interface PreparedMasterUpdate {
  manifest: QuestionMasterManifest;
  datasets: QuestionMasterDataset[];
  touchedPaths: string[];
}

export interface GitHubRepositoryClient {
  getBranchHead(branch: string): Promise<{ commitSha: string; treeSha: string }>;
  readJsonFile(path: string, ref: string): Promise<unknown>;
  branchExists(branch: string): Promise<boolean>;
  createCommitOnBranch(input: {
    branch: string;
    baseCommitSha: string;
    baseTreeSha: string;
    message: string;
    files: Array<{ path: string; content: string }>;
  }): Promise<string>;
  findPullRequest(branch: string): Promise<GitHubPullRequest | null>;
  createPullRequest(input: {
    branch: string;
    baseBranch: string;
    title: string;
    body: string;
  }): Promise<GitHubPullRequest>;
  getPullRequest(number: number): Promise<GitHubPullRequest>;
}

export interface WorkerDependencies {
  authenticate(request: Request, env: WorkerEnv): Promise<AuthenticatedIdentity>;
  createGitHubClient(env: WorkerEnv): Promise<GitHubRepositoryClient>;
  now(): Date;
}

export interface ValidatedCommand extends CreateContentPullRequestCommand {
  changes: Array<
    CreateContentPullRequestCommand["changes"][number] & { after: Question }
  >;
}

export type PullRequestResult = CreateContentPullRequestResult;
