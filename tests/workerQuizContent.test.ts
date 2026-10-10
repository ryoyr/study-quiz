import assert from "node:assert/strict";
import test from "node:test";
import { questions } from "../src/data/questions.ts";
import {
  buildQuestionMasterChanges,
  createContentPullRequestCommand,
} from "../src/services/questionMasterChangeService.ts";
import type { Question } from "../src/types/Question.ts";
import type { QuestionMasterSnapshot } from "../src/types/QuestionMaster.ts";
import { ApiError } from "../workers/quiz-content-pr/src/http.ts";
import { GitHubApiError } from "../workers/quiz-content-pr/src/github.ts";
import { handleRequest } from "../workers/quiz-content-pr/src/index.ts";
import {
  createQuestionMasterPullRequest,
  prepareMasterUpdate,
} from "../workers/quiz-content-pr/src/pullRequestService.ts";
import type {
  GitHubPullRequest,
  GitHubRepositoryClient,
  RepositoryMaster,
  ValidatedCommand,
  WorkerDependencies,
  WorkerEnv,
} from "../workers/quiz-content-pr/src/types.ts";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const masterQuestions = clone(questions.slice(0, 2));
const snapshot: QuestionMasterSnapshot = {
  manifest: {
    schemaVersion: 1,
    contentVersion: "2026.10.11.1",
    updatedAt: "2026-10-11T00:00:00.000Z",
    datasets: [
      { id: "lpic-101", version: 1, path: "questions/lpic-101.json", questionCount: 2 },
    ],
  },
  datasets: [
    { schemaVersion: 1, datasetId: "lpic-101", version: 1, questions: masterQuestions },
  ],
  questions: masterQuestions,
};

const command = async (): Promise<ValidatedCommand> => {
  const local = clone(masterQuestions);
  local[0].explanation = "GitHubへ提案する更新";
  return (await createContentPullRequestCommand(
    snapshot,
    buildQuestionMasterChanges(snapshot, local),
    {
      title: "問題マスター更新",
      body: "レビューをお願いします。",
      commitMessage: "Update quiz content",
    },
  )) as ValidatedCommand;
};

const env = (): WorkerEnv => ({
  GITHUB_APP_ID: "12345",
  GITHUB_INSTALLATION_ID: "67890",
  GITHUB_PRIVATE_KEY: "test-only",
  GITHUB_OWNER: "example",
  GITHUB_REPO: "study-quiz",
  GITHUB_BASE_BRANCH: "main",
  GITHUB_CONTENT_ROOT: "public/content",
  ALLOWED_ORIGIN: "https://example.github.io",
  ACCESS_TEAM_DOMAIN: "example.cloudflareaccess.com",
  ACCESS_AUD: "audience",
  ALLOWED_EMAILS: "editor@example.com",
  RATE_LIMITER: { limit: async () => ({ success: true }) },
});

class FakeGitHub implements GitHubRepositoryClient {
  branchPresent = false;
  pullRequest: GitHubPullRequest | null = null;
  committedFiles: Array<{ path: string; content: string }> = [];
  commitCalls = 0;

  async getBranchHead(): Promise<{ commitSha: string; treeSha: string }> {
    return { commitSha: "base-commit", treeSha: "base-tree" };
  }
  async readJsonFile(path: string): Promise<unknown> {
    if (path.endsWith("manifest.json")) return clone(snapshot.manifest);
    return clone(snapshot.datasets[0]);
  }
  async branchExists(): Promise<boolean> {
    return this.branchPresent;
  }
  async createCommitOnBranch(input: {
    branch: string;
    baseCommitSha: string;
    baseTreeSha: string;
    message: string;
    files: Array<{ path: string; content: string }>;
  }): Promise<string> {
    this.commitCalls += 1;
    this.committedFiles = input.files;
    this.branchPresent = true;
    return "new-commit";
  }
  async findPullRequest(): Promise<GitHubPullRequest | null> {
    return this.pullRequest;
  }
  async createPullRequest(input: { branch: string }): Promise<GitHubPullRequest> {
    this.pullRequest = {
      number: 42,
      html_url: "https://github.com/example/study-quiz/pull/42",
      state: "open",
      merged_at: null,
      head: { ref: input.branch },
    };
    return this.pullRequest;
  }
  async getPullRequest(): Promise<GitHubPullRequest> {
    if (!this.pullRequest) throw new Error("not found");
    return this.pullRequest;
  }
}

class FailingCommitGitHub extends FakeGitHub {
  override async createCommitOnBranch(): Promise<string> {
    throw new GitHubApiError(500, "commit failed");
  }
}

class FlakyPullRequestGitHub extends FakeGitHub {
  pullAttempts = 0;
  override async createPullRequest(input: { branch: string }): Promise<GitHubPullRequest> {
    this.pullAttempts += 1;
    if (this.pullAttempts === 1) throw new GitHubApiError(500, "pull request failed");
    return super.createPullRequest(input);
  }
}

const repository = (): RepositoryMaster => ({
  baseCommitSha: "base-commit",
  baseTreeSha: "base-tree",
  manifest: clone(snapshot.manifest),
  datasets: clone(snapshot.datasets),
});

test("Workersは変更対象データセットだけを更新し版を進める", async () => {
  const prepared = prepareMasterUpdate(
    repository(),
    await command(),
    new Date("2026-10-11T02:00:00.000Z"),
  );
  assert.equal(prepared.datasets[0].version, 2);
  assert.equal(prepared.datasets[0].questions[0].explanation, "GitHubへ提案する更新");
  assert.equal(prepared.manifest.datasets[0].version, 2);
  assert.deepEqual(prepared.touchedPaths, ["manifest.json", "questions/lpic-101.json"]);
});

test("GitHub側で同じ問題が変更済みなら上書きせず409相当で停止する", async () => {
  const changedRepository = repository();
  changedRepository.datasets[0].questions[0].text = "GitHub側の別変更";
  const cmd = await command();
  assert.throws(
    () =>
      prepareMasterUpdate(
        changedRepository,
        cmd,
        new Date("2026-10-11T02:00:00.000Z"),
      ),
    /GitHub側で変更/u,
  );
});

test("専用ブランチへマニフェストとデータセットを1コミットしPRを作成する", async () => {
  const github = new FakeGitHub();
  const result = await createQuestionMasterPullRequest(
    github,
    env(),
    await command(),
    new Date("2026-10-11T02:00:00.000Z"),
  );
  assert.equal(result.number, 42);
  assert.equal(result.reused, false);
  assert.equal(github.commitCalls, 1);
  assert.deepEqual(
    github.committedFiles.map((file) => file.path),
    ["public/content/manifest.json", "public/content/questions/lpic-101.json"],
  );
  assert.match(result.branch, /^quiz-content\/20261011-[0-9a-f]{12}$/u);
});

test("同じ冪等ブランチがある場合はコミットを増やさず既存PRを返す", async () => {
  const github = new FakeGitHub();
  const first = await createQuestionMasterPullRequest(
    github,
    env(),
    await command(),
    new Date("2026-10-11T02:00:00.000Z"),
  );
  const second = await createQuestionMasterPullRequest(
    github,
    env(),
    await command(),
    new Date("2026-10-12T02:00:00.000Z"),
  );
  assert.equal(first.number, second.number);
  assert.equal(second.reused, true);
  assert.equal(github.commitCalls, 1);
});

test("コミット失敗を成功扱いにせず、PR失敗後の再送ではコミットを重複させない", async () => {
  await assert.rejects(
    createQuestionMasterPullRequest(
      new FailingCommitGitHub(),
      env(),
      await command(),
      new Date("2026-10-11T02:00:00.000Z"),
    ),
    /commit failed/u,
  );

  const github = new FlakyPullRequestGitHub();
  const cmd = await command();
  await assert.rejects(
    createQuestionMasterPullRequest(
      github,
      env(),
      cmd,
      new Date("2026-10-11T02:00:00.000Z"),
    ),
    /pull request failed/u,
  );
  const recovered = await createQuestionMasterPullRequest(
    github,
    env(),
    cmd,
    new Date("2026-10-12T02:00:00.000Z"),
  );
  assert.equal(recovered.reused, true);
  assert.equal(github.commitCalls, 1);
  assert.equal(github.pullAttempts, 2);
});

test("HTTP境界はオリジン・認証・レート制限を適用してからGitHubへ渡す", async () => {
  const github = new FakeGitHub();
  const cmd = await command();
  const dependencies: WorkerDependencies = {
    authenticate: async () => ({ email: "editor@example.com", subject: "user-1" }),
    createGitHubClient: async () => github,
    now: () => new Date("2026-10-11T02:00:00.000Z"),
  };
  const response = await handleRequest(
    new Request("https://worker.example.com/api/quiz-content/pull-requests", {
      method: "POST",
      headers: {
        origin: "https://example.github.io",
        "content-type": "application/json",
        "x-idempotency-key": cmd.idempotencyKey,
      },
      body: JSON.stringify(cmd),
    }),
    env(),
    dependencies,
  );
  assert.equal(response.status, 201);
  assert.equal(response.headers.get("access-control-allow-origin"), "https://example.github.io");
});

test("未認証、未許可オリジン、レート超過を拒否する", async () => {
  const github = new FakeGitHub();
  const cmd = await command();
  const unauthorized: WorkerDependencies = {
    authenticate: async () => {
      throw new ApiError(401, "AUTHENTICATION_REQUIRED", "サインインが必要です。");
    },
    createGitHubClient: async () => github,
    now: () => new Date(),
  };
  const request = (origin: string) =>
    new Request("https://worker.example.com/api/quiz-content/pull-requests", {
      method: "POST",
      headers: { origin, "x-idempotency-key": cmd.idempotencyKey },
      body: JSON.stringify(cmd),
    });
  assert.equal((await handleRequest(request("https://example.github.io"), env(), unauthorized)).status, 401);
  assert.equal((await handleRequest(request("https://evil.example"), env(), unauthorized)).status, 403);

  const limitedEnv = env();
  limitedEnv.RATE_LIMITER = { limit: async () => ({ success: false }) };
  const authenticated: WorkerDependencies = {
    authenticate: async () => ({ email: "editor@example.com", subject: "user-1" }),
    createGitHubClient: async () => github,
    now: () => new Date(),
  };
  assert.equal(
    (await handleRequest(request("https://example.github.io"), limitedEnv, authenticated)).status,
    429,
  );

  const arbitraryTarget = {
    ...cmd,
    repository: "attacker/other-repository",
    filePath: "secrets.txt",
  };
  const arbitraryResponse = await handleRequest(
    new Request("https://worker.example.com/api/quiz-content/pull-requests", {
      method: "POST",
      headers: {
        origin: "https://example.github.io",
        "x-idempotency-key": cmd.idempotencyKey,
      },
      body: JSON.stringify(arbitraryTarget),
    }),
    env(),
    authenticated,
  );
  assert.equal(arbitraryResponse.status, 400);
});
