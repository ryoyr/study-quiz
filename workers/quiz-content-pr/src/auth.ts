import { ApiError } from "./http";
import type { AuthenticatedIdentity, WorkerEnv } from "./types";

interface AccessJwtHeader {
  alg?: string;
  kid?: string;
}

interface AccessJwtPayload {
  aud?: string | string[];
  email?: string;
  exp?: number;
  iat?: number;
  iss?: string;
  nbf?: number;
  sub?: string;
}

interface AccessJwk extends JsonWebKey {
  alg?: string;
  kid?: string;
}

interface AccessCerts {
  keys?: AccessJwk[];
}

const certCache = new Map<string, { expiresAt: number; keys: AccessJwk[] }>();

const arrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;

const decodeBase64Url = (value: string): Uint8Array => {
  const normalized = value.replace(/-/gu, "+").replace(/_/gu, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const decoded = atob(padded);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
};

const decodeJson = <T>(value: string): T => {
  try {
    return JSON.parse(new TextDecoder().decode(decodeBase64Url(value))) as T;
  } catch {
    throw new ApiError(401, "INVALID_ACCESS_TOKEN", "認証トークンを解析できません。");
  }
};

const normalizeTeamDomain = (value: string): string => {
  const domain = value.trim().toLowerCase();
  if (!/^[a-z0-9-]+\.cloudflareaccess\.com$/u.test(domain)) {
    throw new ApiError(
      503,
      "ACCESS_NOT_CONFIGURED",
      "Cloudflare Accessのチームドメインが未設定です。",
    );
  }
  return domain;
};

const loadSigningKeys = async (
  domain: string,
  fetcher: typeof fetch,
): Promise<AccessJwk[]> => {
  const cached = certCache.get(domain);
  if (cached && cached.expiresAt > Date.now()) return cached.keys;
  const response = await fetcher(`https://${domain}/cdn-cgi/access/certs`, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new ApiError(
      503,
      "ACCESS_CERTS_UNAVAILABLE",
      "Cloudflare Accessの署名鍵を取得できません。",
    );
  }
  const body = (await response.json()) as AccessCerts;
  const keys = Array.isArray(body.keys) ? body.keys : [];
  if (keys.length === 0) {
    throw new ApiError(503, "ACCESS_CERTS_INVALID", "Cloudflare Accessの署名鍵が不正です。");
  }
  certCache.set(domain, { expiresAt: Date.now() + 5 * 60_000, keys });
  return keys;
};

const audienceMatches = (audience: string | string[] | undefined, expected: string): boolean =>
  typeof audience === "string"
    ? audience === expected
    : Array.isArray(audience) && audience.includes(expected);

const allowedEmailSet = (value: string): Set<string> =>
  new Set(
    value
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );

export const verifyAccessIdentity = async (
  request: Request,
  env: WorkerEnv,
  fetcher: typeof fetch = fetch,
): Promise<AuthenticatedIdentity> => {
  const token = request.headers.get("cf-access-jwt-assertion");
  if (!token) {
    throw new ApiError(
      401,
      "AUTHENTICATION_REQUIRED",
      "Cloudflare Accessへのサインインが必要です。",
      "Accessで認証してから再試行してください。",
    );
  }
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new ApiError(401, "INVALID_ACCESS_TOKEN", "認証トークンの形式が不正です。");
  }
  const header = decodeJson<AccessJwtHeader>(parts[0]);
  const payload = decodeJson<AccessJwtPayload>(parts[1]);
  if (header.alg !== "RS256" || !header.kid) {
    throw new ApiError(401, "INVALID_ACCESS_TOKEN", "認証トークンの署名方式が不正です。");
  }
  const domain = normalizeTeamDomain(env.ACCESS_TEAM_DOMAIN);
  const keys = await loadSigningKeys(domain, fetcher);
  const jwk = keys.find((key) => key.kid === header.kid && key.alg === "RS256");
  if (!jwk) {
    throw new ApiError(401, "ACCESS_KEY_NOT_FOUND", "認証トークンの署名鍵を確認できません。");
  }
  const publicKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const verified = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    publicKey,
    arrayBuffer(decodeBase64Url(parts[2])),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
  const now = Math.floor(Date.now() / 1000);
  if (
    !verified ||
    payload.iss !== `https://${domain}` ||
    !audienceMatches(payload.aud, env.ACCESS_AUD) ||
    typeof payload.exp !== "number" ||
    payload.exp <= now ||
    (typeof payload.nbf === "number" && payload.nbf > now + 30) ||
    typeof payload.email !== "string" ||
    typeof payload.sub !== "string"
  ) {
    throw new ApiError(401, "INVALID_ACCESS_TOKEN", "認証トークンを検証できませんでした。");
  }
  const email = payload.email.trim().toLowerCase();
  const allowed = allowedEmailSet(env.ALLOWED_EMAILS);
  if (allowed.size === 0) {
    throw new ApiError(
      503,
      "AUTHORIZATION_NOT_CONFIGURED",
      "GitHub連携を許可する利用者が設定されていません。",
    );
  }
  if (!allowed.has(email)) {
    throw new ApiError(
      403,
      "WRITE_NOT_ALLOWED",
      "この利用者には問題マスターの書込み権限がありません。",
    );
  }
  return { email, subject: payload.sub };
};
