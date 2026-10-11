import type { AccessIdentity, WorkerEnv } from "./types";
import { isRecord } from "./validation";

const decoder = new TextDecoder();

const decodeBase64Url = (value: string): Uint8Array<ArrayBuffer> => {
  const normalized = value.replace(/-/gu, "+").replace(/_/gu, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const decodeJson = (value: string): Record<string, unknown> => {
  const parsed: unknown = JSON.parse(decoder.decode(decodeBase64Url(value)));
  if (!isRecord(parsed)) throw new Error("Access JWTを検証できませんでした。");
  return parsed;
};

const allowedEmails = (env: WorkerEnv): Set<string> =>
  new Set(env.ALLOWED_EMAILS.split(",").map((value) => value.trim().toLowerCase()).filter(Boolean));

export const verifyAccessIdentity = async (
  request: Request,
  env: WorkerEnv,
  fetcher: typeof fetch = fetch,
): Promise<AccessIdentity> => {
  const url = new URL(request.url);
  if ((url.hostname === "localhost" || url.hostname === "127.0.0.1") && env.ALLOW_LOCAL_WRITE === "true") {
    return { email: "local-development", subject: "local-development" };
  }
  const token = request.headers.get("cf-access-jwt-assertion");
  if (!token) throw new Error("Cloudflare Accessでサインインしてください。");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Access JWTを検証できませんでした。");
  const header = decodeJson(parts[0]);
  const payload = decodeJson(parts[1]);
  if (header.alg !== "RS256" || typeof header.kid !== "string") throw new Error("Access JWTを検証できませんでした。");

  const teamDomain = env.ACCESS_TEAM_DOMAIN.trim().replace(/^https?:\/\//u, "").replace(/\/$/u, "");
  const response = await fetcher(`https://${teamDomain}/cdn-cgi/access/certs`, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error("Access署名鍵を取得できませんでした。");
  const certs: unknown = await response.json();
  if (!isRecord(certs) || !Array.isArray(certs.keys)) throw new Error("Access署名鍵を検証できませんでした。");
  const jwk = certs.keys.find((item) => isRecord(item) && item.kid === header.kid);
  if (!isRecord(jwk)) throw new Error("Access JWTの署名鍵が見つかりません。");
  const key = await crypto.subtle.importKey(
    "jwk",
    jwk as JsonWebKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const verified = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    decodeBase64Url(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
  const now = Math.floor(Date.now() / 1000);
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  const issuer = `https://${teamDomain}`;
  if (!verified || payload.iss !== issuer || !aud.includes(env.ACCESS_AUD) ||
      typeof payload.exp !== "number" || payload.exp < now ||
      (typeof payload.nbf === "number" && payload.nbf > now + 30) ||
      typeof payload.iat !== "number" || payload.iat > now + 30 ||
      typeof payload.email !== "string" || typeof payload.sub !== "string") {
    throw new Error("Access JWTを検証できませんでした。");
  }
  const email = payload.email.toLowerCase();
  if (!allowedEmails(env).has(email)) throw new Error("この利用者にはD1書込み権限がありません。");
  return { email, subject: payload.sub };
};
