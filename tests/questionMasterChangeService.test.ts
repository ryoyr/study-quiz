import assert from "node:assert/strict";
import test from "node:test";
import { questions } from "../src/data/questions.ts";
import {
  buildQuestionMasterChanges,
  createContentPullRequestCommand,
} from "../src/services/questionMasterChangeService.ts";
import type { Question } from "../src/types/Question.ts";
import type { QuestionMasterSnapshot } from "../src/types/QuestionMaster.ts";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const snapshotOf = (items: Question[]): QuestionMasterSnapshot => ({
  manifest: {
    schemaVersion: 1,
    contentVersion: "2026.10.11.1",
    updatedAt: "2026-10-11T00:00:00.000Z",
    datasets: [
      {
        id: "lpic-101",
        version: 1,
        path: "questions/lpic-101.json",
        questionCount: items.length,
      },
    ],
  },
  datasets: [
    { schemaVersion: 1, datasetId: "lpic-101", version: 1, questions: items },
  ],
  questions: items,
});

test("追加・更新・アーカイブを問題ID単位で分類する", () => {
  const master = clone(questions.slice(0, 3));
  const local = clone(master);
  local[0].text = "更新後の問題文";
  local[1].archivedAt = "2026-10-11T01:00:00.000Z";
  local.push({ ...clone(master[2]), id: "LOCAL-001", text: "新しい問題" });

  const changes = buildQuestionMasterChanges(snapshotOf(master), local);
  assert.deepEqual(
    changes.map((change) => [change.questionId, change.operation]),
    [
      ["LOCAL-001", "add"],
      [master[0].id, "update"],
      [master[1].id, "archive"],
    ].sort((left, right) => String(left[0]).localeCompare(String(right[0]))),
  );
  assert.deepEqual(
    changes.find((change) => change.questionId === master[0].id)?.changedFields,
    ["text"],
  );
});

test("同じ送信内容から同じ冪等キーを生成する", async () => {
  const master = clone(questions.slice(0, 1));
  const local = clone(master);
  local[0].explanation = "更新後";
  const snapshot = snapshotOf(master);
  const changes = buildQuestionMasterChanges(snapshot, local);
  const values = {
    title: "問題マスター更新",
    body: "問題文と解説を更新します。",
    commitMessage: "Update quiz content",
  };
  const first = await createContentPullRequestCommand(snapshot, changes, values);
  const second = await createContentPullRequestCommand(snapshot, changes, values);
  assert.equal(first.idempotencyKey, second.idempotencyKey);
  assert.match(first.idempotencyKey, /^[0-9a-f]{64}$/u);
  assert.equal(first.baseContentVersion, "2026.10.11.1");
});
