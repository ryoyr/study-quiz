import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join } from "node:path";

const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };
const text = (path) => readFileSync(path, "utf8");
const json = (path) => JSON.parse(text(path));
const readTree = (directory) =>
  readdirSync(directory, { withFileTypes: true })
    .map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? readTree(path) : text(path);
    })
    .join("\n");

const required = [
  "README.md", "D1_MIGRATION_PLAN.md", "TASKS_D1.md", "package.json", "package-lock.json",
  "docs/d1-cloudflare-setup.md", "docs/requirements.md", "docs/basic-design.md", "docs/detailed-design.md", "docs/traceability.md",
  "public/content/manifest.json", "public/content/questions/lpic-101.json", "public/sw.js",
  "src/types/Question.ts", "src/types/QuestionMaster.ts", "src/services/d1ContentApi.ts",
  "src/services/questionMasterService.ts", "src/services/questionMasterChangeService.ts",
  "src/pages/QuestionMasterPage.tsx", "scripts/generate-d1-seed.mjs", "scripts/verify-d1-migrations.py",
  "workers/quiz-content-db/wrangler.toml", "workers/quiz-content-db/tsconfig.json",
  "workers/quiz-content-db/migrations/0001_schema.sql",
  "workers/quiz-content-db/migrations/0002_seed_content.sql",
  "workers/quiz-content-db/src/index.ts", "workers/quiz-content-db/src/auth.ts",
  "workers/quiz-content-db/src/http.ts", "workers/quiz-content-db/src/repository.ts",
  "workers/quiz-content-db/src/validation.ts", "tools/generate_pwa_icons.py",
  "tests/d1ContentApi.test.ts", "tests/d1AccessAuth.test.ts", "tests/d1Worker.test.ts",
  "tests/d1WorkerHttp.test.ts", "tests/questionMasterChangeService.test.ts",
  "tests/questionMasterService.test.ts", "tests/questionMasterUi.test.ts",
];
for (const path of required) assert(existsSync(path), `${path} がありません`);

const retiredPaths = [
  "src/services/contentPullRequestApi.ts",
  "tests/contentPullRequestApi.test.ts",
  "tests/workerQuizContent.test.ts",
  "tests/workerAccessAuth.test.ts",
  "workers/quiz-content-pr",
  "docs/github-cloudflare-setup.md",
  "docs/github-integration-assessment.md",
  "docs/github-integration-progress.md",
  "VALIDATION_REPORT_CLOUDFLARE_ACCESS_20261011.md",
  "VALIDATION_REPORT_4.7.0.md",
];
for (const path of retiredPaths) {
  assert(!existsSync(path), `${path} はD1移行後の廃止対象です`);
}

const pkg = json("package.json");
const lock = json("package-lock.json");
assert(pkg.version === "5.0.0", "package.jsonの版は5.0.0である必要があります");
assert(lock.version === pkg.version, "package-lock.jsonの版が一致しません");
assert(lock.packages?.[""]?.version === pkg.version, "lockfile root packageの版が一致しません");
for (const name of [
  "verify:structure", "test", "typecheck", "build", "test:e2e", "check",
  "d1:seed:build", "verify:d1-migrations", "d1:migrate:local", "d1:migrate:remote",
  "worker:typecheck", "worker:dev", "worker:deploy",
]) {
  assert(typeof pkg.scripts?.[name] === "string", `scripts.${name} がありません`);
}
assert(
  pkg.scripts.check ===
    "npm run verify:structure && npm run d1:seed:build && npm run verify:d1-migrations && npm run test && npm run typecheck && npm run worker:typecheck && npm run build && npm run test:e2e",
  "scripts.checkの検証順または対象が不正です",
);
for (const [name, command] of Object.entries(pkg.scripts ?? {})) {
  if (typeof command !== "string") continue;
  assert(!/quiz-content-pr|contentPullRequest|pull-requests/u.test(command), `scripts.${name} が旧GitHub PR経路を参照しています`);
}

const rootTsconfig = json("tsconfig.json");
assert(
  JSON.stringify(rootTsconfig.references) ===
    JSON.stringify([{ path: "./tsconfig.app.json" }, { path: "./tsconfig.node.json" }]),
  "tsconfig.jsonの参照構成が不正です",
);
const appTsconfig = json("tsconfig.app.json");
const nodeTsconfig = json("tsconfig.node.json");
for (const [path, config] of [["tsconfig.app.json", appTsconfig], ["tsconfig.node.json", nodeTsconfig]]) {
  assert(config.compilerOptions?.strict === true, `${path}: strict=trueが必要です`);
  assert(config.compilerOptions?.noEmit === true, `${path}: noEmit=trueが必要です`);
  assert(config.compilerOptions?.moduleResolution === "Bundler", `${path}: moduleResolution=Bundlerが必要です`);
}
assert(JSON.stringify(appTsconfig.include) === JSON.stringify(["src"]), "tsconfig.app.jsonはsrcだけを対象にしてください");
assert(nodeTsconfig.include?.includes("tests/**/*.ts"), "tsconfig.node.jsonは全テストを型検査する必要があります");

const wrangler = text("workers/quiz-content-db/wrangler.toml");
for (const token of [
  'main = "src/index.ts"',
  'binding = "DB"',
  'database_name = "study-quiz-db"',
  'database_id = "e342a769-d2fc-493f-88a7-9aac70f7914c"',
  'migrations_dir = "migrations"',
  'ALLOW_LOCAL_WRITE = "false"',
]) assert(wrangler.includes(token), `wrangler.toml に ${token} がありません`);
assert(!/CF-Access-Client-Secret|PRIVATE_KEY|API_TOKEN/u.test(wrangler), "wrangler.tomlへ秘密情報を含めてはいけません");
const migrations = readdirSync("workers/quiz-content-db/migrations")
  .filter((name) => name.endsWith(".sql"))
  .sort();
assert(
  JSON.stringify(migrations) === JSON.stringify(["0001_schema.sql", "0002_seed_content.sql"]),
  `D1 migration構成が不正です: ${migrations.join(", ")}`,
);

const manifest = json("public/content/manifest.json");
const dataset = json("public/content/questions/lpic-101.json");
assert(manifest.datasets?.[0]?.questionCount === dataset.questions?.length, "同梱snapshotの件数が一致しません");
const seed = text("workers/quiz-content-db/migrations/0002_seed_content.sql");
const seedCount = (seed.match(/INSERT OR IGNORE INTO questions/gu) ?? []).length;
assert(seedCount === dataset.questions.length, `D1 seed件数が一致しません: ${seedCount}/${dataset.questions.length}`);

const pngSize = (path) => {
  const bytes = readFileSync(path);
  assert(bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a", `${path} はPNGではありません`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
};
for (const [path, size] of [
  ["public/apple-touch-icon.png", 180],
  ["public/pwa-192x192.png", 192],
  ["public/pwa-512x512.png", 512],
  ["public/pwa-maskable-512x512.png", 512],
]) {
  assert(existsSync(path), `${path} がありません`);
  if (existsSync(path)) {
    const actual = pngSize(path);
    assert(actual.width === size && actual.height === size, `${path} の寸法が不正です`);
    assert(statSync(path).size > 100, `${path} が小さすぎます`);
  }
}

const validation = text("workers/quiz-content-db/src/validation.ts");
const auth = text("workers/quiz-content-db/src/auth.ts");
const http = text("workers/quiz-content-db/src/http.ts");
const index = text("workers/quiz-content-db/src/index.ts");
const repository = text("workers/quiz-content-db/src/repository.ts");
const changeService = text("src/services/questionMasterChangeService.ts");
const masterService = text("src/services/questionMasterService.ts");
const d1Api = text("src/services/d1ContentApi.ts");
const page = text("src/pages/QuestionMasterPage.tsx");
assert(validation.includes('"distribution" in value'), "Workerのlocal-only拒否境界がありません");
assert(changeService.includes('distributionOf(local) === "local-only"'), "クライアントのlocal-only除外境界がありません");
assert(masterService.includes('QUESTION_MASTER_AUTHORITY = "cloudflare-d1"'), "D1正本宣言がありません");
assert(masterService.includes("bundled-snapshot") && masterService.includes("indexeddb-cache"), "offline fallbackが不足しています");
assert(page.includes("<ConfirmDialog") && page.includes("ローカル専用"), "D1送信前確認UIが不足しています");
for (const token of ["SNAPSHOT_PATH", "CHANGES_PATH", "ACCESS_SESSION_PATH", "HEALTH_PATH"]) {
  assert(index.includes(token), `D1 Workerの公開経路 ${token} がありません`);
}
for (const token of ["RS256", "ACCESS_AUD", "ALLOWED_EMAILS", "exp", "iat"]) {
  assert(auth.includes(token), `Access認証検証 ${token} がありません`);
}
for (const token of ["same-origin", "content-security-policy", "x-study-quiz-access-relay"]) {
  assert(http.includes(token), `Access popup relay保護 ${token} がありません`);
}
for (const token of ["content_write_lock", "idempotency_keys", "question_revisions", "baseFingerprint"]) {
  const schema = text("workers/quiz-content-db/migrations/0001_schema.sql");
  assert(index.includes(token) || repository.includes(token) || validation.includes(token) || schema.includes(token), `D1保護 ${token} がありません`);
}
for (const token of ["api/content/snapshot", "api/content/changes", "applyD1ChangesWithAccessSession"]) {
  assert(d1Api.includes(token), `アプリ側D1 API呼出し ${token} がありません`);
}

const activeRuntime = [
  readTree("src"),
  readTree("workers/quiz-content-db/src"),
  text("package.json"),
  text("tsconfig.json"),
  text("tsconfig.app.json"),
  text("tsconfig.node.json"),
  text(".github/workflows/deploy.yml"),
].join("\n");
for (const token of [
  "CreateContentPullRequestCommand",
  "CreateContentPullRequestResult",
  "createContentPullRequestCommand",
  "contentPullRequestApi",
  "quiz-content-pr",
  "/api/quiz-content/pull-requests",
]) {
  assert(!activeRuntime.includes(token), `実行・ビルド経路に旧GitHub PR要素 ${token} が残っています`);
}
const workflow = text(".github/workflows/deploy.yml");
assert(workflow.includes("workers/quiz-content-db/tsconfig.json"), "CIがD1 Workerを型検査していません");
assert(workflow.includes("vars.QUIZ_CONTENT_API_URL"), "CIがD1 Worker公開URLを受け取っていません");
assert(text("public/sw.js").includes("${CACHE_PREFIX}v25"), "Service Workerはv25である必要があります");

if (failures.length) {
  console.error(`構成検証で ${failures.length} 件の問題を検出しました。`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`構成検証に成功しました（D1 ${seedCount}問、旧PR経路0、local-only二重境界、Access/JWT、offline fallback、PWA）。`);
}
