# Release Manifest — Study Quiz 4.7.0 seed update tool fix

## Identification

- Release: `study-quiz-v4.7.0-seed-tool-fixed-20261011`
- Archive: `study-quiz_v4.7.0_seed-tool-fixed_20261011.zip`
- Baseline dump: generated 2026-10-11 03:05:15, 193 text files
- Complete baseline: `study-quiz_v4.7.0_typecheck-fixed.zip`; only the 18 files absent from the text dump were restored
- Application version: 4.7.0
- Storage schema: 9
- IndexedDB version: 2
- Full backup format: 10（reads 2–10）
- Service Worker cache generation: v23
- Question master schema: 1
- Worker API command schema: 1

## Package contents

- Project-root layout; extract where `package.json` is located.
- Existing application source and tests
- `public/content`: manifest and question datasets
- `workers/quiz-content-pr`: Cloudflare Access／GitHub App Worker
- GitHub integration assessment, setup, progress, validation, and task records
- PWA PNG assets and deterministic regeneration tool
- Corrected seed-update CLI and five focused regression tests
- `node_modules`, `dist`, coverage, caches, logs, received dumps, production Secrets, `wrangler.toml`, and VCS metadata are excluded.

## Compatibility

- Existing `Question` and question IDs are unchanged.
- Existing question storage key, history, FSRS state, and IndexedDB version are unchanged.
- Storage schema 9 and full backup version 10 are unchanged.
- Old backup versions 2–10 remain accepted.
- Question master sync metadata is registered but excluded from full backup because it is non-secret, derived, and re-fetchable.
- The application version, storage schema, backup format, question IDs, and content datasets are unchanged by this correction.

## Required deliverables

- `docs/github-integration-assessment.md`: current-state and impact assessment
- `docs/github-integration-progress.md`: four-round target, plan, execution, verification, remaining work
- `docs/github-cloudflare-setup.md`: GitHub App, Access, Worker, deployment, usage, failure, and cost guide
- `VALIDATION_REPORT_4.7.0.md`: executed checks and explicit limitations
- `TASK_MANAGEMENT.md`: current task state
- `SHA256SUMS_COMPLETE.txt`: per-file integrity list

## Seed update tool correction

- Resolves the CLI root with `fileURLToPath(import.meta.url)` so URL-encoded spaces are not treated as literal path text.
- Validates pack metadata and the same Question constraints used by application boundaries.
- Preserves validated existing overrides, merges updates by question ID, and emits deterministic ID order.
- Writes through a same-directory temporary file and removes temporary residue on failure.
- Focused tests cover space-containing paths, a different process CWD, existing override preservation, unknown IDs, duplicate updates, invalid Question data, and before-ID mismatch.

## Integrity

- Package inventory: 211 files including `SHA256SUMS_COMPLETE.txt`.
- `SHA256SUMS_COMPLETE.txt`: 210 SHA-256 entries covering every other packaged file.

`SHA256SUMS_COMPLETE.txt` contains hashes for every packaged file except the checksum file itself.

```bash
sha256sum -c SHA256SUMS_COMPLETE.txt
```

## Installation acceptance gate

```bash
npm ci --no-audit --no-fund && npm run check
```

```bash
cd workers/quiz-content-pr && npm ci && npm run typecheck
```

The packaged environment could not acquire Vite 7.3.6 because the registry returned HTTP 403. The focused seed-tool tests passed 5/5 and structure validation passed. The exact `npm run typecheck`, `npm test`, `npm run build`, and `npm run check` attempts failed or stopped because locked dependencies were unavailable; these results and the 139/145 shared-runner result are recorded in `VALIDATION_REPORT_4.7.0.md`. Normal CI must install the lockfile and complete `npm run check` before production deployment.
