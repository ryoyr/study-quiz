# Release Manifest — Study Quiz 4.6.0 question quality

## Identification

- Release: `study-quiz-v4.6.0-question-quality-20261011`
- Baseline dump: generated 2026-10-11 00:12:36, 165 text files
- Application version: 4.6.0
- Storage schema: 9
- IndexedDB version: 2
- Full backup format: 10（reads 2–10）
- Service Worker cache generation: v22

## Package contents

- Project-root layout; extract where `package.json` is located.
- Total files: 181, including this manifest and `SHA256SUMS_COMPLETE.txt`.
- Source, tests, requirements, designs, assessment, task table, recommendations, removal list, PWA assets, lock file, and CI configuration are included.
- `node_modules`, `dist`, coverage, caches, logs, received dump, and VCS metadata are excluded.

## Required deliverables

- `CURRENT_STATE_ASSESSMENT.md`: current state and requirement/design gaps
- `CHANGE_SUMMARY.md`: implemented changes
- `TASK_MANAGEMENT.md`: prioritized task table
- `FUTURE_RECOMMENDATIONS.md`: recommended next actions
- `REMOVAL_CANDIDATES.md`: removed and future removal candidates
- `VALIDATION_REPORT_4.5.0.md`: verification evidence and limitations
- `VALIDATION_REPORT_4.6.0.md`: question-quality verification evidence and limitations
- `REMEDIATION_REVIEW_20261010.md`: priority review, changes, compatibility, validation, and remaining tasks
- `docs/requirements.md`: current requirements
- `docs/basic-design.md`: current architecture
- `docs/detailed-design.md`: answer-type detailed design
- `docs/traceability.md`: requirement-to-code/test mapping
- `docs/question-quality-design.md`: JSON contracts, proposal lifecycle, apply transaction, seed update design

## Integrity

`SHA256SUMS_COMPLETE.txt` contains hashes for every packaged file except the checksum file itself.

```bash
sha256sum -c SHA256SUMS_COMPLETE.txt
```

## Installation acceptance gate

```bash
npm ci --no-audit --no-fund && npm run check
```

The remediation checks are listed in `REMEDIATION_REVIEW_20261010.md`. The expanded Chrome E2E passed with the temporary verification build; the same E2E after the official locked-dependency Vite build remains the target environment's final gate because npm package retrieval returned HTTP 403 during packaging.
