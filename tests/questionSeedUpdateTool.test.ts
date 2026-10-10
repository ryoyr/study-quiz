import assert from "node:assert/strict";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const question = {
  id: "Q-1",
  examScopeId: "lpic101",
  category: "Linux",
  text: "改善後の問題",
  choices: ["A", "B"],
  answerIndex: 0,
  explanation: "改善後の解説",
  weight: 1,
  difficulty: 1,
};

test("初期データ更新JSONを将来の初期問題上書きへ反映する", () => {
  const root = mkdtempSync(join(tmpdir(), "study-quiz-seed-tool-"));
  mkdirSync(join(root, "tools"), { recursive: true });
  mkdirSync(join(root, "src/data"), { recursive: true });
  cpSync(
    "tools/apply_question_seed_updates.mjs",
    join(root, "tools/apply_question_seed_updates.mjs"),
  );
  writeFileSync(
    join(root, "src/data/questions.ts"),
    'const q = (...args: unknown[]) => args;\nconst baseQuestions = [q("Q-1")];\n',
  );
  writeFileSync(
    join(root, "src/data/questionQualityOverrides.ts"),
    'import type { Question } from "../types/Question";\nexport const questionQualityOverrides: Question[] = [];\n',
  );
  const packPath = join(root, "pack.json");
  writeFileSync(
    packPath,
    JSON.stringify({
      format: "study-quiz-question-seed-updates",
      version: 1,
      appVersion: "4.6.0",
      exportedAt: "2026-10-11T00:00:00.000Z",
      updates: [{
        questionId: question.id,
        proposalId: "P-1",
        appliedAt: "2026-10-11T00:00:00.000Z",
        beforeQuestion: { ...question, text: "元の問題", explanation: "元の解説" },
        question,
      }],
    }),
  );

  const result = spawnSync(
    process.execPath,
    [join(root, "tools/apply_question_seed_updates.mjs"), packPath],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  const output = readFileSync(
    join(root, "src/data/questionQualityOverrides.ts"),
    "utf8",
  );
  assert.match(output, /Q-1/);
  assert.match(output, /改善後の解説/);
});
