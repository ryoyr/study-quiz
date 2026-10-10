import assert from "node:assert/strict";
import test from "node:test";
import { questions as bundledQuestions } from "../src/data/questions.ts";
import {
  applyQuestionMasterMerge,
  fetchQuestionMaster,
  fingerprintQuestions,
  parseQuestionMasterDataset,
  parseQuestionMasterManifest,
  planQuestionMasterMerge,
} from "../src/services/questionMasterService.ts";
import type { Question } from "../src/types/Question.ts";
import type {
  QuestionMasterSnapshot,
  QuestionMasterSyncState,
} from "../src/types/QuestionMaster.ts";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const snapshotOf = (
  questions: Question[],
  contentVersion = "2026.10.11.1",
): QuestionMasterSnapshot => ({
  manifest: {
    schemaVersion: 1,
    contentVersion,
    updatedAt: "2026-10-11T00:00:00.000Z",
    datasets: [
      {
        id: "lpic-101",
        version: 1,
        path: "questions/lpic-101.json",
        questionCount: questions.length,
      },
    ],
  },
  datasets: [
    { schemaVersion: 1, datasetId: "lpic-101", version: 1, questions },
  ],
  questions,
});

const stateOf = (questions: Question[]): QuestionMasterSyncState => ({
  schemaVersion: 1,
  contentVersion: "2026.10.10.1",
  datasetVersions: { "lpic-101": 1 },
  questionFingerprints: fingerprintQuestions(questions),
  checkedAt: "2026-10-10T00:00:00.000Z",
});

test("問題マスターのマニフェストとデータセットを検証する", () => {
  const snapshot = snapshotOf(clone(bundledQuestions));
  assert.deepEqual(parseQuestionMasterManifest(snapshot.manifest), snapshot.manifest);
  assert.deepEqual(
    parseQuestionMasterDataset(
      snapshot.datasets[0],
      snapshot.manifest.datasets[0],
    ),
    snapshot.datasets[0],
  );
  assert.throws(
    () =>
      parseQuestionMasterManifest({
        ...snapshot.manifest,
        datasets: [
          {
            ...snapshot.manifest.datasets[0],
            path: "../secrets.json",
          },
        ],
      }),
    /マニフェスト形式/u,
  );
});

test("初回同期でも端末で編集した問題を上書きしない", () => {
  const local = clone(bundledQuestions);
  local[0].text = "端末で編集した問題文";
  const remote = clone(bundledQuestions);
  remote[0].text = "配布元でも変更された問題文";

  const plan = planQuestionMasterMerge(
    local,
    snapshotOf(remote),
    null,
    "2026-10-11T01:00:00.000Z",
  );
  assert.equal(plan.conflicts.length, 1);
  assert.equal(plan.conflicts[0].reason, "LOCAL_AND_REMOTE_CHANGED");
  assert.equal(applyQuestionMasterMerge(local, plan)[0].text, "端末で編集した問題文");
});

test("端末で未変更の配布問題だけを安全に更新する", () => {
  const baseline = clone(bundledQuestions);
  const remote = clone(baseline);
  remote[0].explanation = "配布元で更新された解説";
  const plan = planQuestionMasterMerge(
    clone(baseline),
    snapshotOf(remote),
    stateOf(baseline),
  );

  assert.deepEqual(plan.actions.map((action) => action.kind), ["update"]);
  assert.equal(plan.conflicts.length, 0);
  assert.equal(
    applyQuestionMasterMerge(clone(baseline), plan)[0].explanation,
    "配布元で更新された解説",
  );
});

test("配布元から消えた未編集問題は物理削除せずアーカイブする", () => {
  const baseline = clone(bundledQuestions.slice(0, 2));
  const plan = planQuestionMasterMerge(
    clone(baseline),
    snapshotOf([clone(baseline[0])]),
    stateOf(baseline),
  );
  assert.equal(plan.actions.length, 1);
  assert.equal(plan.actions[0].kind, "archive");
  const merged = applyQuestionMasterMerge(clone(baseline), plan);
  assert.equal(merged.length, 2);
  assert.equal(merged[1].archivedAt, "2026-10-11T00:00:00.000Z");
});

test("複数データセット間の問題ID重複を拒否する", async () => {
  const question = clone(bundledQuestions[0]);
  const manifest = {
    schemaVersion: 1,
    contentVersion: "2026.10.11.1",
    updatedAt: "2026-10-11T00:00:00.000Z",
    datasets: [
      { id: "a", version: 1, path: "questions/a.json", questionCount: 1 },
      { id: "b", version: 1, path: "questions/b.json", questionCount: 1 },
    ],
  };
  const responses = new Map<string, unknown>([
    ["https://example.test/content/manifest.json", manifest],
    [
      "https://example.test/content/questions/a.json",
      { schemaVersion: 1, datasetId: "a", version: 1, questions: [question] },
    ],
    [
      "https://example.test/content/questions/b.json",
      { schemaVersion: 1, datasetId: "b", version: 1, questions: [question] },
    ],
  ]);
  const fetcher: typeof fetch = async (input) => {
    const key = input instanceof URL ? input.href : String(input);
    return new Response(JSON.stringify(responses.get(key)), {
      status: responses.has(key) ? 200 : 404,
      headers: { "content-type": "application/json" },
    });
  };
  await assert.rejects(
    fetchQuestionMaster(fetcher, new URL("https://example.test/content/")),
    /複数データセット間/u,
  );
});
