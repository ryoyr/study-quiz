import { ApiError } from "./http";
import type {
  GitHubPullRequest,
  GitHubRepositoryClient,
  WorkerEnv,
} from "./types";

const API_ROOT = "https://api.github.com";
const API_VERSION = "2022-11-28";

export class GitHubApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "GitHubApiError";
    this.status = status;
  }
}

const base64Url = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/gu, "").replace(/\+/gu, "-").replace(/\//gu, "_");
};

const base64UrlJson = (value: unknown): string =>
  base64Url(new TextEncoder().encode(JSON.stringify(value)));

const pemBytes = (pem: string, label: string): Uint8Array => {
  const pattern = new RegExp(
    `-----BEGIN ${label}-----([\\s\\S]+?)-----END ${label}-----`,
    "u",
  );
  const match = pattern.exec(pem.replaceAll("\\n", "\n"));
  if (!match) throw new ApiError(503, "GITHUB_PRIVATE_KEY_INVALID", "GitHub App秘密鍵を読み込めません。");
  const binary = atob(match[1].replace(/\s/gu, ""));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const asn1Length = (length: number): Uint8Array => {
  if (length < 128) return Uint8Array.of(length);
  const bytes: number[] = [];
  for (let value = length; value > 0; value >>>= 8) bytes.unshift(value & 0xff);
  return Uint8Array.of(0x80 | bytes.length, ...bytes);
};

const asn1 = (tag: number, value: Uint8Array): Uint8Array =>
  Uint8Array.of(tag, ...asn1Length(value.length), ...value);

const concat = (...arrays: Uint8Array[]): Uint8Array => {
  const result = new Uint8Array(arrays.reduce((sum, value) => sum + value.length, 0));
  let offset = 0;
  for (const value of arrays) {
    result.set(value, offset);
    offset += value.length;
  }
  return result;
};

const arrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;

const privateKeyDer = (pem: string): Uint8Array => {
  if (pem.includes("BEGIN PRIVATE KEY")) return pemBytes(pem, "PRIVATE KEY");
  const pkcs1 = pemBytes(pem, "RSA PRIVATE KEY");
  const version = Uint8Array.of(0x02, 0x01, 0x00);
  const rsaAlgorithm = Uint8Array.of(
    0x30, 0x0d,
    0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01,
    0x05, 0x00,
  );
  return asn1(0x30, concat(version, rsaAlgorithm, asn1(0x04, pkcs1)));
};

export const createGitHubAppJwt = async (
  appId: string,
  privateKeyPem: string,
  now = new Date(),
): Promise<string> => {
  if (!/^\d+$/u.test(appId)) {
    throw new ApiError(503, "GITHUB_APP_ID_INVALID", "GitHub App IDが不正です。");
  }
  const issuedAt = Math.floor(now.getTime() / 1000) - 60;
  const encodedHeader = base64UrlJson({ alg: "RS256", typ: "JWT" });
  const encodedPayload = base64UrlJson({
    iat: issuedAt,
    exp: issuedAt + 9 * 60,
    iss: appId,
  });
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    arrayBuffer(privateKeyDer(privateKeyPem)),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${base64Url(new Uint8Array(signature))}`;
};

const githubRequest = async <T>(
  fetcher: typeof fetch,
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<T> => {
  const response = await fetcher(`${API_ROOT}${path}`, {
    ...init,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": API_VERSION,
      "user-agent": "study-quiz-content-worker",
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) {
    throw new GitHubApiError(response.status, `GitHub APIがHTTP ${response.status}を返しました。`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
};

const installationToken = async (
  env: WorkerEnv,
  fetcher: typeof fetch,
): Promise<string> => {
  if (!/^\d+$/u.test(env.GITHUB_INSTALLATION_ID)) {
    throw new ApiError(503, "GITHUB_INSTALLATION_INVALID", "GitHub App installation IDが不正です。");
  }
  const appJwt = await createGitHubAppJwt(
    env.GITHUB_APP_ID,
    env.GITHUB_PRIVATE_KEY,
  );
  const result = await githubRequest<{ token?: string }>(
    fetcher,
    `/app/installations/${env.GITHUB_INSTALLATION_ID}/access_tokens`,
    appJwt,
    { method: "POST", body: JSON.stringify({}) },
  );
  if (!result.token) {
    throw new ApiError(502, "GITHUB_TOKEN_MISSING", "GitHub Appの一時トークンを取得できません。");
  }
  return result.token;
};

const encodePath = (path: string): string =>
  path.split("/").map(encodeURIComponent).join("/");

const decodeGitHubContent = (content: string): string => {
  const binary = atob(content.replace(/\s/gu, ""));
  return new TextDecoder().decode(
    Uint8Array.from(binary, (character) => character.charCodeAt(0)),
  );
};

class GitHubClient implements GitHubRepositoryClient {
  constructor(
    private readonly env: WorkerEnv,
    private readonly token: string,
    private readonly fetcher: typeof fetch,
  ) {}

  private repoPath(path: string): string {
    return `/repos/${encodeURIComponent(this.env.GITHUB_OWNER)}/${encodeURIComponent(this.env.GITHUB_REPO)}${path}`;
  }

  private request<T>(path: string, init?: RequestInit): Promise<T> {
    return githubRequest<T>(this.fetcher, this.repoPath(path), this.token, init);
  }

  async getBranchHead(branch: string): Promise<{ commitSha: string; treeSha: string }> {
    const reference = await this.request<{ object: { sha: string } }>(
      `/git/ref/heads/${encodeURIComponent(branch)}`,
    );
    const commit = await this.request<{ tree: { sha: string } }>(
      `/git/commits/${reference.object.sha}`,
    );
    return { commitSha: reference.object.sha, treeSha: commit.tree.sha };
  }

  async readJsonFile(path: string, ref: string): Promise<unknown> {
    const file = await this.request<{ type: string; encoding: string; content: string }>(
      `/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`,
    );
    if (file.type !== "file" || file.encoding !== "base64") {
      throw new GitHubApiError(422, "GitHub上の問題マスターファイル形式が不正です。");
    }
    try {
      return JSON.parse(decodeGitHubContent(file.content)) as unknown;
    } catch {
      throw new GitHubApiError(422, "GitHub上の問題マスターをJSONとして読み込めません。");
    }
  }

  async branchExists(branch: string): Promise<boolean> {
    try {
      await this.request(`/git/ref/heads/${encodeURIComponent(branch)}`);
      return true;
    } catch (error) {
      if (error instanceof GitHubApiError && error.status === 404) return false;
      throw error;
    }
  }

  async createCommitOnBranch(input: {
    branch: string;
    baseCommitSha: string;
    baseTreeSha: string;
    message: string;
    files: Array<{ path: string; content: string }>;
  }): Promise<string> {
    const entries = await Promise.all(
      input.files.map(async (file) => {
        const blob = await this.request<{ sha: string }>("/git/blobs", {
          method: "POST",
          body: JSON.stringify({ content: file.content, encoding: "utf-8" }),
        });
        return { path: file.path, mode: "100644", type: "blob", sha: blob.sha };
      }),
    );
    const tree = await this.request<{ sha: string }>("/git/trees", {
      method: "POST",
      body: JSON.stringify({ base_tree: input.baseTreeSha, tree: entries }),
    });
    const commit = await this.request<{ sha: string }>("/git/commits", {
      method: "POST",
      body: JSON.stringify({
        message: input.message,
        tree: tree.sha,
        parents: [input.baseCommitSha],
      }),
    });
    await this.request("/git/refs", {
      method: "POST",
      body: JSON.stringify({
        ref: `refs/heads/${input.branch}`,
        sha: commit.sha,
      }),
    });
    return commit.sha;
  }

  async findPullRequest(branch: string): Promise<GitHubPullRequest | null> {
    const items = await this.request<GitHubPullRequest[]>(
      `/pulls?state=all&head=${encodeURIComponent(`${this.env.GITHUB_OWNER}:${branch}`)}&per_page=10`,
    );
    return items[0] ?? null;
  }

  createPullRequest(input: {
    branch: string;
    baseBranch: string;
    title: string;
    body: string;
  }): Promise<GitHubPullRequest> {
    return this.request<GitHubPullRequest>("/pulls", {
      method: "POST",
      body: JSON.stringify({
        title: input.title,
        body: input.body,
        head: input.branch,
        base: input.baseBranch,
        draft: false,
        maintainer_can_modify: false,
      }),
    });
  }

  getPullRequest(number: number): Promise<GitHubPullRequest> {
    return this.request<GitHubPullRequest>(`/pulls/${number}`);
  }
}

export const createGitHubClient = async (
  env: WorkerEnv,
  fetcher: typeof fetch = fetch,
): Promise<GitHubRepositoryClient> => {
  for (const [name, value] of Object.entries({
    GITHUB_OWNER: env.GITHUB_OWNER,
    GITHUB_REPO: env.GITHUB_REPO,
    GITHUB_BASE_BRANCH: env.GITHUB_BASE_BRANCH,
    GITHUB_CONTENT_ROOT: env.GITHUB_CONTENT_ROOT,
  })) {
    if (!value?.trim()) {
      throw new ApiError(503, "GITHUB_NOT_CONFIGURED", `${name}が未設定です。`);
    }
  }
  return new GitHubClient(env, await installationToken(env, fetcher), fetcher);
};
