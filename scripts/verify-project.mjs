import { existsSync, readFileSync, statSync } from "node:fs";

const failures = [];
const assert = (condition, message) => {
  if (!condition) failures.push(message);
};
const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    failures.push(`${path} をJSONとして読み込めません: ${error.message}`);
    return {};
  }
};
const readPngSize = (path) => {
  try {
    const bytes = readFileSync(path);
    assert(bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a", `${path} はPNGではありません`);
    assert(bytes.length >= 24, `${path} のPNGヘッダーが不足しています`);
    return bytes.length >= 24
      ? { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
      : { width: 0, height: 0 };
  } catch (error) {
    failures.push(`${path} を読み込めません: ${error.message}`);
    return { width: 0, height: 0 };
  }
};

const requiredFiles = [
  "index.html",
  "package.json",
  "tsconfig.json",
  "tsconfig.app.json",
  "tsconfig.node.json",
  "vite.config.ts",
  "public/manifest.webmanifest",
  "public/sw.js",
  "src/main.tsx",
  "src/App.tsx",
  "src/services/storageKeyRegistry.ts",
  "tests/storageKeyRegistry.test.ts",
];
for (const path of requiredFiles) assert(existsSync(path), `${path} がありません`);

const packageJson = readJson("package.json");
for (const script of ["verify:structure", "test", "typecheck", "build", "check"]) {
  assert(typeof packageJson.scripts?.[script] === "string", `scripts.${script} がありません`);
}
assert(
  packageJson.scripts?.check?.includes("verify:structure") &&
    packageJson.scripts?.check?.includes("test") &&
    packageJson.scripts?.check?.includes("build"),
  "scripts.check は構成検証・テスト・ビルドを順に実行する必要があります",
);

const rootConfig = readJson("tsconfig.json");
const references = new Set((rootConfig.references ?? []).map((item) => item.path));
assert(references.has("./tsconfig.app.json"), "tsconfig.app.json への参照がありません");
assert(references.has("./tsconfig.node.json"), "tsconfig.node.json への参照がありません");
for (const path of ["tsconfig.app.json", "tsconfig.node.json"]) {
  const config = readJson(path);
  assert(config.compilerOptions?.strict === true, `${path}: strict=true が必要です`);
  assert(config.compilerOptions?.noEmit === true, `${path}: noEmit=true が必要です`);
  assert(config.compilerOptions?.moduleResolution === "Bundler", `${path}: moduleResolution=Bundler が必要です`);
}
const appConfig = readJson("tsconfig.app.json");
assert(appConfig.compilerOptions?.jsx === "react-jsx", "tsconfig.app.json: jsx=react-jsx が必要です");

const retiredPaths = [
  "src/components/BottomNavigation.tsx",
  "src/pages/GeminiSettingsSection.tsx",
  "src/pages/HomePage.tsx",
  "src/pages/QuizPage.tsx",
  "src/pages/SetupPage.tsx",
  "src/services/backupService.ts",
  "src/services/geminiService.ts",
  "src/services/setupFlow.ts",
  "src/services/sessionService.ts",
  "src/types/AppScreen.ts",
  "src/types/Session.ts",
  "src/major",
  "src/enhancements",
  "src/assets",
  "src/ui-enhancement.css",
  "public/favicon.svg",
  "public/icons.svg",
];
for (const path of retiredPaths) assert(!existsSync(path), `${path} は削除対象です`);

const manifest = readJson("public/manifest.webmanifest");
assert(manifest.start_url === "./", "manifest.start_url は ./ である必要があります");
assert(manifest.scope === "./", "manifest.scope は ./ である必要があります");
assert(Array.isArray(manifest.icons) && manifest.icons.length >= 3, "manifest.icons が不足しています");
for (const icon of manifest.icons ?? []) {
  const path = `public/${icon.src}`;
  assert(existsSync(path), `${path} がありません`);
  const expected = Number(String(icon.sizes).split("x")[0]);
  const actual = readPngSize(path);
  assert(actual.width === expected && actual.height === expected, `${path} の寸法が ${icon.sizes} ではありません`);
  if (existsSync(path)) assert(statSync(path).size > 100, `${path} のファイルサイズが不正です`);
}
const appleIcon = readPngSize("public/apple-touch-icon.png");
assert(appleIcon.width === 180 && appleIcon.height === 180, "apple-touch-icon.png は180x180である必要があります");

for (const [path, tokens] of [
  ["src/main.tsx", ["<ErrorBoundary>", "<PwaUpdatePrompt />"]],
  ["public/sw.js", ["SKIP_WAITING", "matchAll", "pwa-maskable-512x512.png"]],
]) {
  try {
    const source = readFileSync(path, "utf8");
    for (const token of tokens) assert(source.includes(token), `${path} に ${token} がありません`);
  } catch (error) {
    failures.push(`${path} を検証できません: ${error.message}`);
  }
}

if (failures.length > 0) {
  console.error(`構成検証で ${failures.length} 件の問題を検出しました。`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("構成検証に成功しました（TypeScript設定、PWA資材、統合状態）。");
}

