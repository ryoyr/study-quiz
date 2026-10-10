# Copilot remediation review — 2026-10-10

## 1. Scope and baseline

- Review criteria: `COPILOT_REMEDIATION_PRIORITIES.md`
- Latest dump used for source-of-truth text: generated 2026-10-11 00:12:36, 165 text files
- Binary/completeness baseline: `study-quiz-v4.5.0-complete-20261010.zip`
- Existing dump-only changes were overlaid onto the complete archive before review.
- Existing localStorage keys, storage schema 8, IndexedDB version 2, backup version 9, and backup versions 2–9 read compatibility were retained.
- No user data, existing source changes, PWA binary assets, or generation tools were removed.

## 2. Findings and changes by priority

### P0 — storage, restore, migration

1. **Corrupt transaction journals were deleted without recovery.**
   - Changed recovery to retain the journal and stop writes with a blocking error.
   - App initialization now shows a data-safety stop screen instead of continuing with potentially partial values.

2. **Legacy history could be deleted even when corrupt or in conflict with current history.**
   - Legacy and current arrays are now validated, including required fields, timestamps, nonblank IDs, limits, and duplicate history IDs.
   - Valid legacy history can rescue an absent, invalid, or empty current history.
   - Corrupt or conflicting histories are both retained and automatic migration stops.

3. **Backup validation did not enforce all key invariants.**
   - Rejects whitespace-only identifiers.
   - Rejects duplicate IDs for notes, annotations, correction suggestions, and prompt templates.
   - Enforces `correctCount + incorrectCount = totalCount`.
   - Validates the complete stored FSRS card shape, timestamp fields, nonnegative values, integer counters, and state range.

### P1 — learning/session correctness

1. **Question state rebuild used lexical timestamp ordering and accepted future/invalid history.**
   - Rebuild now uses validated numeric timestamps with stable tie ordering.
   - Future and invalid history is excluded.
   - Loaded/saved states use the same state/FSRS validator and reject duplicate question states.
   - State updates normalize duplicate question IDs to one entry.

2. **Session and analysis services could include archived questions, future history, or invalid dates.**
   - Adaptive, custom-filter, weak, forgetting, speed, trend, streak, and final-review paths now exclude invalid/future history and archived questions where applicable.
   - Due dates are compared numerically after validation.
   - Candidate order remains deterministic.

3. **Zero limits or zero candidates could be reported as one item/minute.**
   - Zero-result sessions and final reviews now report 0 items and 0 estimated minutes.
   - Weak/forgetting/speed selectors respect a limit of zero.

4. **CSV quoting accepted malformed input and lacked a service-layer total-size guard.**
   - Quotes are accepted only at field start.
   - Characters after a closing quote are rejected unless they are a delimiter or line ending.
   - A 5 MiB-equivalent service-layer character limit is checked before matrix allocation.

### P2 — async state, PWA failures, large-array safety

1. **Async exam-scope initialization could update state after unmount.**
   - Added a cancellation check after the awaited read.

2. **PWA update/install promise failures could be unhandled.**
   - Update checks and install prompts now catch failures and present the existing error notice.
   - Deferred service-worker callbacks check disposal state.

3. **Large arrays were spread into `Math.max`.**
   - Replaced affected chart, session, and final-review maximum calculations with bounded reductions.

### P3 — maintainability

- Reused one exported question-state/FSRS validator between normal storage and full-backup validation.
- No unrelated component split, CSS split, naming sweep, or broad refactor was performed.

## 3. Compatibility verification

- Physical localStorage keys: unchanged.
- Storage schema: 8, unchanged.
- IndexedDB version: 2, unchanged.
- Full backup current version: 9, unchanged.
- Full backup input compatibility: versions 2–9, unchanged.
- Legacy question/history compatibility fields: unchanged.
- Secret handling: Gemini API key remains excluded from full backups.
- Binary PWA assets from the complete archive were retained.

## 4. Verification results

| Check | Result | Detail |
|---|---|---|
| Project structure | PASS | `node scripts/verify-project.mjs` |
| Full unit test set | PASS with test harness substitution | 146/146 passed after TypeScript 5.9.3 temporary transpilation; a test-only `ts-fsrs` import stub was used because the locked package could not be downloaded. Product source was not changed for the substitution. |
| Changed service/data strict type check | PASS | TypeScript 5.9.3, strict, ES2023/DOM, Bundler resolution; temporary declaration only for unavailable `ts-fsrs`. |
| TS/TSX syntax parse | PASS | 135 files with TypeScript 5.9.3. |
| Python syntax | PASS | PWA icon generation script. |
| JavaScript syntax | PASS | project verification and E2E scripts. |
| Official `npm ci` | BLOCKED | Vite 7.3.6 returned HTTP 403 from the configured package proxy. |
| Official `npm run typecheck` | BLOCKED | Locked dependencies could not be restored. |
| Official `npm run build` | BLOCKED | Locked dependencies could not be restored. |
| Chrome E2E | BLOCKED | Dependency/build gate was unavailable; browser E2E must run in CI. |
| Archive and internal hashes | PASS | 170 files, 169/169 internal hashes, ZIP compression and extracted verification passed. |

## 5. Added boundary coverage

- Corrupt transaction journal retention and write blocking.
- Corrupt/conflicting legacy history retention.
- Empty-current-history rescue from valid legacy data.
- Whitespace and duplicate backup IDs.
- Question-state counter invariants and invalid FSRS cards.
- Stable numeric history ordering, invalid dates, and future dates.
- Archived questions across selection and analytics.
- Zero candidate/zero limit behavior.
- Malformed CSV quotes and oversized CSV text.
- Async initialization cancellation and PWA promise failure handling.

## 6. Remaining tasks

1. Run `npm ci --no-audit --no-fund && npm run check` in an environment that can fetch the locked packages and has Chrome/Chromium.
2. Confirm the restore-download UX in supported production browsers; an ordinary browser download cannot provide a cross-browser programmatic guarantee that the user completed the file save.
3. Keep the existing longer-term items in `TASK_MANAGEMENT.md` (real-device iOS acceptance, encrypted/signed backups, and server-side API-key handling).

## 7. 2026-10-11 continuation

- Implemented the remaining P1 browser E2E for single-choice, multiple-choice, and text-answer questions.
- The scenario performs CSV registration, answers all three modes, checks the displayed response/correct answer, verifies persisted history fields, downloads a full backup, removes the target data, restores the downloaded file, and verifies the round trip.
- Added E2E contract and history-snapshot tests; the full unit set is now 151/151 passing.
- Chrome E2E passed twice consecutively using a temporary browser build of the product source. Because the locked Vite package remained HTTP 403, the temporary verification build used the available React 19.2.1 runtime and a test-only `ts-fsrs` adapter; neither is included in the deliverable.

## 8. 4.5.1 history snapshot

- New history records store an optional snapshot of the question text, answer type, rendered response, and rendered correct answer.
- History rendering prefers the snapshot, so later question edits or deletion do not change the display of new past answers.
- Old history without a snapshot remains valid and falls back to the current question.
- Snapshot validation is shared by normal loading and full-backup validation; physical keys, storage schema 8, IndexedDB 2, and backup version 9 remain unchanged.

## 9. 4.6.0 question quality

- Added JSON export and copy-based external review prompts for question and explanation quality.
- Added structured correction/supplement proposals with before/after question snapshots and pending/applied/rejected states.
- Applying a proposal detects stale source data and updates the question, seed version, and proposal state in one storage transaction.
- Applied proposals can be exported as a seed-update pack and validated into `questionQualityOverrides.ts` for future new environments.
- Added schema 9 and backup version 10 while retaining backup input versions 2～10.
