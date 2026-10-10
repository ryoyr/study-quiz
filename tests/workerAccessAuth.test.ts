import assert from "node:assert/strict";
import test from "node:test";
import { verifyAccessIdentity } from "../workers/quiz-content-pr/src/auth.ts";
import type { WorkerEnv } from "../workers/quiz-content-pr/src/types.ts";

const base64Url = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/gu, "").replace(/\+/gu, "-").replace(/\//gu, "_");
};
const encodedJson = (value: unknown): string =>
  base64Url(new TextEncoder().encode(JSON.stringify(value)));

const fixture = async (
  domain: string,
  overrides: Record<string, unknown> = {},
) => {
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
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    pair.privateKey,
    new TextEncoder().encode(input),
  );
  return {
    token: `${input}.${base64Url(new Uint8Array(signature))}`,
    fetcher: (async () =>
      new Response(JSON.stringify({ keys: [publicJwk] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as typeof fetch,
  };
};

const env = (): WorkerEnv => ({
  GITHUB_APP_ID: "1",
  GITHUB_INSTALLATION_ID: "2",
  GITHUB_PRIVATE_KEY: "unused",
  GITHUB_OWNER: "example",
  GITHUB_REPO: "study-quiz",
  GITHUB_BASE_BRANCH: "main",
  GITHUB_CONTENT_ROOT: "public/content",
  ALLOWED_ORIGIN: "https://example.github.io",
  ACCESS_TEAM_DOMAIN: "example.cloudflareaccess.com",
  ACCESS_AUD: "access-audience",
  ALLOWED_EMAILS: "editor@example.com",
});

test("Cloudflare Access JWTの署名・issuer・audience・有効期限・利用者を検証する", async () => {
  const domain = "auth1.cloudflareaccess.com";
  const { token, fetcher } = await fixture(domain);
  const environment = env();
  environment.ACCESS_TEAM_DOMAIN = domain;
  const identity = await verifyAccessIdentity(
    new Request("https://worker.example.com", {
      headers: { "cf-access-jwt-assertion": token },
    }),
    environment,
    fetcher,
  );
  assert.deepEqual(identity, { email: "editor@example.com", subject: "access-user-1" });
});

test("Access audience不一致と未許可メールを拒否する", async () => {
  const audienceDomain = "auth2.cloudflareaccess.com";
  const invalidAudience = await fixture(audienceDomain, { aud: "another-audience" });
  const audienceEnv = env();
  audienceEnv.ACCESS_TEAM_DOMAIN = audienceDomain;
  await assert.rejects(
    verifyAccessIdentity(
      new Request("https://worker.example.com", { headers: { "cf-access-jwt-assertion": invalidAudience.token } }),
      audienceEnv,
      invalidAudience.fetcher,
    ),
    /検証できません/u,
  );

  const emailDomain = "auth3.cloudflareaccess.com";
  const disallowed = await fixture(emailDomain, { email: "other@example.com" });
  const emailEnv = env();
  emailEnv.ACCESS_TEAM_DOMAIN = emailDomain;
  await assert.rejects(
    verifyAccessIdentity(
      new Request("https://worker.example.com", { headers: { "cf-access-jwt-assertion": disallowed.token } }),
      emailEnv,
      disallowed.fetcher,
    ),
    /書込み権限/u,
  );
});
