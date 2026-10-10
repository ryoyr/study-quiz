# Release Manifest — Study Quiz 4.7.0 Cloudflare Access relay fix

## Identification

- Release: `study-quiz-v4.7.0-cloudflare-access-relay-20261011`
- Archive: `study-quiz_v4.7.0_cloudflare-access-relay_20261011.zip`
- Source baseline: latest `project_dump_full.txt`, generated 2026-10-11 03:05:15, plus the previously verified complete package for dump-excluded binary/Worker/tool files
- Application version: 4.7.0
- Frontend: `https://ryoyr.github.io/study-quiz/`
- Worker: `https://study-quiz-content-pr.forxdevelop.workers.dev`
- Worker API: `/api/quiz-content/pull-requests`
- Access session: `/api/quiz-content/access-session`
- GitHub App: `study-quiz-content-manager`
- Repository/base branch: `ryoyr/study-quiz` / `main`
- Storage schema: 9
- IndexedDB version: 2
- Full backup format: 10（reads 2–10）
- Service Worker cache generation: v23
- Question master schema: 1
- Worker API command schema: 1

## Cloudflare Access correction

- Replaces cross-origin API execution with a top-level Access authentication popup and same-origin Worker relay.
- Keeps Cloudflare Access, Google or other configured external IdPs, the existing OPTIONS bypass, Worker CORS, JWT verification, allowed-email authorization, and Rate Limiting.
- Does not bypass Access for API or session GET requests.
- Does not expose Access JWTs, service tokens, GitHub App credentials, or installation tokens to the frontend.
- Keeps the direct `credentials: "include"` client for compatibility, but the UI uses the popup relay so API execution does not depend on cross-site cookies.
- Maintains deterministic idempotency branches and never updates or merges `main` directly.

## Package contents

- Project-root layout; extract where `package.json` is located.
- Existing application source, tests, PWA assets, tools, and problem content.
- `workers/quiz-content-pr`: Worker source and non-secret `wrangler.toml`.
- `docs/github-cloudflare-setup.md`: exact Access, Worker, Pages, GitHub App, and acceptance steps.
- `VALIDATION_REPORT_CLOUDFLARE_ACCESS_20261011.md`: root cause, options, changes, tests, limits, and pending production checks.
- `TASK_MANAGEMENT.md`: completion and pending production tasks.
- `SHA256SUMS_COMPLETE.txt`: all packaged files except itself.
- `node_modules`, `dist`, coverage, caches, logs, received dumps, `.dev.vars`, production secrets, and VCS metadata are excluded.

## Compatibility and unchanged data

- Existing `Question` fields, question IDs, question master JSON, and seed questions are unchanged.
- Existing question storage key, history, FSRS state, storage schema, IndexedDB version, and backup format are unchanged.
- Old backup versions 2–10 remain accepted.
- `public/content/manifest.json`, `public/content/questions/lpic-101.json`, and `src/data/questions.ts` match the pre-change SHA-256 values.
- No real GitHub API write, branch, commit, Pull Request, merge, or main update was performed.

## Required Cloudflare configuration

1. Protect `study-quiz-content-pr.forxdevelop.workers.dev/api/quiz-content/*` in the existing Access application.
2. Keep Google or the currently configured external IdP and identity Allow policy.
3. Keep **Bypass OPTIONS requests to origin**; do not add an Everyone Bypass policy.
4. Set `ACCESS_AUD` to the existing application AUD.
5. Set `ALLOWED_EMAILS` to the approved writers.
6. Keep `ALLOWED_ORIGIN=https://ryoyr.github.io` and `ACCESS_TEAM_DOMAIN=abrsb.cloudflareaccess.com`.
7. Confirm the existing Rate Limiting namespace before deploying `wrangler.toml`.
8. Keep the `study-quiz-content-manager` App ID, installation ID, and private key in Worker Secrets.
9. Deploy the Worker, then rebuild and deploy GitHub Pages.

## Validation summary

- Worker strict TypeScript: passed.
- Frontend content API isolated strict TypeScript: passed.
- Cloudflare/GitHub focused tests: 21/21 passed.
- Structure and secret-configuration checks: passed.
- Temporary frontend bundle scan: 623,425 bytes; GitHub App and Access secret patterns found: 0.
- Shared-runner full tests: 145/151 passed; six suites could not start because `ts-fsrs` was unavailable.
- Official dependency install: blocked by HTTP 403 for Vite 7.3.6.
- Official `npm run typecheck`, `npm test`, `npm run build`, and `npm run check`: attempted, but not completed because locked dependencies were unavailable.
- Production URL probes: blocked by the execution environment URL policy; no production mutation was attempted.

## Integrity

- Package inventory: 213 files including `SHA256SUMS_COMPLETE.txt`.
- `SHA256SUMS_COMPLETE.txt`: 212 entries.

```bash
sha256sum -c SHA256SUMS_COMPLETE.txt
```

## Installation acceptance gate

```bash
npm ci --no-audit --no-fund && npm run check
```

```bash
npx --no-install tsc -p workers/quiz-content-pr/tsconfig.json
```

Production deployment remains conditional on the locked-dependency CI gate and the Cloudflare/browser acceptance steps in `VALIDATION_REPORT_CLOUDFLARE_ACCESS_20261011.md`.
