import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceToolPath = join(
  projectRoot,
  "tools/apply_question_seed_updates.mjs",
);

const question = (id: string, text = "改善後の問題") => ({
  id,
  examScopeId: "lpic101",
  category: "Linux",
  text,
  choices: ["A", "B"],
  answerIndex: 0,
  explanation: `${text}の解説`,
  weight: 1,
  difficulty: 1,
});

const createFixture = (existingOverrides: object[] = []) => {
  const root = mkdtempSync(join(tmpdir(), "study quiz seed tool-"));
  mkdirSync(join(root, "tools"), { recursive: true });
  mkdirSync(join(root, "src/data"), { recursive: true });
  cpSync(sourceToolPath, join(root, "tools/apply_question_seed_updates.mjs"));
  writeFileSync(
    join(root, "src/data/questions.ts"),
    'const q = (...args: unknown[]) => args;\nconst baseQuestions = [q("Q-1"), q("Q-2")];\n',
  );
  writeFileSync(
    join(root, "src/data/questionQualityOverrides.ts"),
    `import type { Question } from "../types/Question";\nexport const questionQualityOverrides: Question[] = ${JSON.stringify(existingOverrides, null, 2)};\n`,
  );
  return root;
};

const pack = (updates: object[]) => ({
  format: "study-quiz-question-seed-updates",
  version: 1,
  appVersion: "4.7.0",
  exportedAt: "2026-10-11T00:00:00.000Z",
  updates,
});

const update = (questionId: string, updatedQuestion = question(questionId)) => ({
  questionId,
  proposalId: `P-${questionId}`,
  appliedAt: "2026-10-11T00:00:00.000Z",
  beforeQuestion: question(questionId, "元の問題"),
  question: updatedQuestion,
});

const writePack = (root: string, value: unknown) => {
  const path = join(root, "pack.json");
  writeFileSync(path, JSON.stringify(value));
  return path;
};

const runTool = (root: string, packPath: string) =>
  spawnSync(
    process.execPath,
    [join(root, "tools/apply_question_seed_updates.mjs"), packPath],
    {
      cwd: tmpdir(),
      encoding: "utf8",
    },
  );

const readOverrides = (root: string) => {
  const source = readFileSync(
    join(root, "src/data/questionQualityOverrides.ts"),
    "utf8",
  );
  const match = source.match(
    /export\s+const\s+questionQualityOverrides\s*:[^=]+?=\s*(\[[\s\S]*\])\s*;\s*$/u,
  );
  assert.ok(match, "生成された上書き配列を解析できません");
  return JSON.parse(match[1]) as Array<{ id: string; explanation: string }>;
};

test("空白を含む配置パスでも更新を適用し、既存上書きを保持する", (t) => {
  const existing = question("Q-2", "既存の問題");
  const root = createFixture([existing]);
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const packPath = writePack(root, pack([update("Q-1")]));

  const result = runTool(root, packPath);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /1件を適用し、2件の初期問題上書きを出力/);
  const output = readOverrides(root);
  assert.deepEqual(
    output.map((item) => item.id),
    ["Q-1", "Q-2"],
  );
  assert.equal(output[0].explanation, "改善後の問題の解説");
  assert.equal(output[1].explanation, "既存の問題の解説");
  assert.deepEqual(
    readdirSync(join(root, "src/data")).filter((name) => name.includes(".tmp-")),
    [],
  );
});

test("存在しない初期問題IDは拒否し、既存ファイルを変更しない", (t) => {
  const root = createFixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const outputPath = join(root, "src/data/questionQualityOverrides.ts");
  const before = readFileSync(outputPath, "utf8");
  const packPath = writePack(root, pack([update("Q-404")]));

  const result = runTool(root, packPath);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /初期問題 Q-404 がquestions\.tsに存在しません/);
  assert.equal(readFileSync(outputPath, "utf8"), before);
});

test("同じ問題IDの重複更新は拒否し、既存ファイルを変更しない", (t) => {
  const root = createFixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const outputPath = join(root, "src/data/questionQualityOverrides.ts");
  const before = readFileSync(outputPath, "utf8");
  const packPath = writePack(root, pack([update("Q-1"), update("Q-1")]));

  const result = runTool(root, packPath);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /更新対象 Q-1 が重複しています/);
  assert.equal(readFileSync(outputPath, "utf8"), before);
});

test("共有Question制約に違反する更新後データは拒否する", (t) => {
  const root = createFixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const invalidQuestion = {
    ...question("Q-1"),
    choices: ["A", "A"],
    answerIndex: 2,
    weight: 0,
    difficulty: 6,
  };
  const packPath = writePack(root, pack([update("Q-1", invalidQuestion)]));

  const result = runTool(root, packPath);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /更新後問題形式が不正/);
  assert.match(result.stderr, /同一内容の選択肢/);
  assert.match(result.stderr, /正解の選択肢指定/);
  assert.match(result.stderr, /出題ウェイト/);
  assert.match(result.stderr, /難易度/);
});

test("更新前問題IDとquestionIdの不一致を拒否する", (t) => {
  const root = createFixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const item = {
    ...update("Q-1"),
    beforeQuestion: question("Q-2", "元の問題"),
  };
  const packPath = writePack(root, pack([item]));

  const result = runTool(root, packPath);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Q-1 の更新前問題IDが一致しません/);
});
