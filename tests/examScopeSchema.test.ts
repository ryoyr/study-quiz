import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { defaultExamScopes } from "../src/data/examScopes.ts";

 test("既定の試験枠はLPIC-1 Exam 101のみ", () => {
  assert.equal(defaultExamScopes.length, 1);
  assert.deepEqual(defaultExamScopes[0], {
    ...defaultExamScopes[0],
    id: "lpic101",
    certification: "LPIC-1",
    examCode: "101-500",
    version: "5.0",
    active: true,
  });
});

test("IndexedDB v2にexamScopesストアと試験コード索引を定義する", () => {
  const source = readFileSync("src/infrastructure/db/database.ts", "utf8");
  assert.match(source, /DATABASE_VERSION = 2/);
  assert.match(source, /createObjectStore\("examScopes"/);
  assert.match(source, /createIndex\("examCode"/);
  assert.match(source, /LEGACY_EXAM_ID = "linuc101"/);
});
