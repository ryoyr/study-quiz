import assert from "node:assert/strict";
import test from "node:test";
import { verifyAccessIdentity } from "../workers/quiz-content-db/src/auth.ts";
import type { WorkerEnv } from "../workers/quiz-content-db/src/types.ts";

const base64Url = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/gu, "").replace(/\+/gu, "-").replace(/\//gu, "_");
};
const encodedJson = (value: unknown): string => base64Url(new TextEncoder().encode(JSON.stringify(value)));

const fixture = async (domain: string, overrides: Record<string, unknown> = {}) => {
  const pair = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: Uint8Array.of(1, 0, 1), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  );
  const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  Object.assign(publicJwk, { kid: "test-key", alg: "RS256", use: "sig" });
  const now = Math.floor(Date.now() / 1000);
  const header = encodedJson({ alg: "RS256", kid: "test-key" });
  const payload = encodedJson({
    iss: `https://${domain}`,
    aud: "access-audience",
    email: "editor@example.com",
    sub: "access-user-1",
    iat: now - 30,
    exp: now + 300,
    ...overrides,
  });
  const input = `${header}.${payload}`;
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", pair.privateKey, new TextEncoder().encode(input));
  return {
    token: `${input}.${base64Url(new Uint8Array(signature))}`,
    fetcher: (async () => new Response(JSON.stringify({ keys: [publicJwk] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as typeof fetch,
  };
};

const env = (): WorkerEnv => ({
  DB: {} as WorkerEnv["DB"],
  ALLOWED_ORIGIN: "https://ryoyr.github.io",
  ACCESS_TEAM_DOMAIN: "auth.cloudflareaccess.com",
  ACCESS_AUD: "access-audience",
  ALLOWED_EMAILS: "editor@example.com",
  ALLOW_LOCAL_WRITE: "false",
});

test("D1 WorkerはAccess JWTの署名・issuer・audience・期限・メールを検証する", async () => {
  const environment = env();
  const signed = await fixture(environment.ACCESS_TEAM_DOMAIN);
  const identity = await verifyAccessIdentity(new Request("https://worker.example.com", {
    headers: { "cf-access-jwt-assertion": signed.token },
  }), environment, signed.fetcher);
  assert.deepEqual(identity, { email: "editor@example.com", subject: "access-user-1" });
});

test("D1 Workerは不正audienceと未許可メールを拒否する", async () => {
  const environment = env();
  const invalidAudience = await fixture(environment.ACCESS_TEAM_DOMAIN, { aud: "other" });
  await assert.rejects(
    verifyAccessIdentity(new Request("https://worker.example.com", { headers: { "cf-access-jwt-assertion": invalidAudience.token } }), environment, invalidAudience.fetcher),
    /検証/u,
  );
  const invalidEmail = await fixture(environment.ACCESS_TEAM_DOMAIN, { email: "other@example.com" });
  await assert.rejects(
    verifyAccessIdentity(new Request("https://worker.example.com", { headers: { "cf-access-jwt-assertion": invalidEmail.token } }), environment, invalidEmail.fetcher),
    /書込み権限/u,
  );
});
