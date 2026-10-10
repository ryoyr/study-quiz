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
  "package-lock.json",
  "README.md",
  "CURRENT_STATE_ASSESSMENT.md",
  "CHANGE_SUMMARY.md",
  "TASK_MANAGEMENT.md",
  "FUTURE_RECOMMENDATIONS.md",
  "REMOVAL_CANDIDATES.md",
  "VALIDATION_REPORT_4.5.0.md",
  "VALIDATION_REPORT_4.6.0.md",
  "RELEASE_MANIFEST.md",
  "docs/requirements.md",
  "docs/basic-design.md",
  "docs/detailed-design.md",
  "docs/traceability.md",
  "docs/question-quality-design.md",
  "docs/github-integration-assessment.md",
  "docs/github-integration-progress.md",
  "docs/github-cloudflare-setup.md",
  "public/content/manifest.json",
  "public/content/questions/lpic-101.json",
  "src/services/questionMasterService.ts",
  "src/services/questionMasterChangeService.ts",
  "src/services/contentPullRequestApi.ts",
  "src/pages/QuestionMasterPage.tsx",
  "src/types/QuestionMaster.ts",
  "workers/quiz-content-pr/src/index.ts",
  "workers/quiz-content-pr/src/auth.ts",
  "workers/quiz-content-pr/src/github.ts",
  "workers/quiz-content-pr/wrangler.toml.example",
  "tsconfig.json",
  "tsconfig.app.json",
  "tsconfig.node.json",
  "vite.config.ts",
  "public/manifest.webmanifest",
  "public/sw.js",
  "src/main.tsx",
  "src/App.tsx",
  "src/services/storageKeyRegistry.ts",
  "src/services/storageSynchronization.ts",
  "src/services/storagePersistenceService.ts",
  "src/services/questionValidation.ts",
  "src/services/questionAnswerModel.ts",
  "src/services/questionQualityService.ts",
  "src/services/questionQualityProposalStorage.ts",
  "src/types/QuestionQualityProposal.ts",
  "src/pages/QuestionQualityGeneratorPage.tsx",
  "src/pages/QuestionQualityReviewPage.tsx",
  "src/data/questionQualityOverrides.ts",
  "src/services/verifiedStorage.ts",
  "src/components/ConcurrentUpdateNotice.tsx",
  "src/components/ConfirmDialog.tsx",
  "src/services/studyOptionService.ts",
  "tests/storageKeyRegistry.test.ts",
  "tests/studyOptionService.test.ts",
  "scripts/e2e-accessibility.mjs",
  "tools/generate_pwa_icons.py",
  "tools/apply_question_seed_updates.mjs",
  "tests/accessibilityHarness.test.ts",
];
for (const path of requiredFiles) assert(existsSync(path), `${path} がありません`);
const packageJson = readJson("package.json");
assert(packageJson.version === "4.7.0", "package.jsonの版は4.7.0である必要があります");
for (const script of ["verify:structure", "test", "test:e2e", "typecheck", "build", "check"]) {
  assert(typeof packageJson.scripts?.[script] === "string", `scripts.${script} がありません`);
}
assert(
  packageJson.scripts?.check?.includes("verify:structure") &&
    packageJson.scripts?.check?.includes("test") &&
    packageJson.scripts?.check?.includes("build") &&
    packageJson.scripts?.check?.includes("test:e2e"),
  "scripts.check は構成検証・テスト・ビルド・E2Eを順に実行する必要があります",
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
  "src/services/setupFlow.ts",
  "src/services/sessionService.ts",
  "src/services/studyPlanService.ts",
  "src/types/AppScreen.ts",
  "src/types/Session.ts",
  "src/major",
  "src/enhancements",
  "src/assets",
  "src/ui-enhancement.css",
  "public/favicon.svg",
  "public/icons.svg",
  "eslint.config.js",
  "APPLY_ACCESSIBILITY_FIX.md",
  "APPLY_GUIDE.md",
  "APPLY_THEME_UPDATE.md",
  "APPLY_UPDATE.md",
  "PATCH_MANIFEST.md",
  "PATCH_MANIFEST_THEME.md",
  "SHA256SUMS.txt",
  "SHA256SUMS_THEME.txt",
  "VALIDATION_REPORT.md",
  "VALIDATION_REPORT_COMPLETE.md",
];
for (const path of retiredPaths) assert(!existsSync(path), `${path} は削除対象です`);
const manifest = readJson("public/manifest.webmanifest");
assert(manifest.id === "./", "manifest.id は ./ である必要があります");
assert(manifest.start_url === "./", "manifest.start_url は ./ である必要があります");
assert(manifest.scope === "./", "manifest.scope は ./ である必要があります");
assert(Array.isArray(manifest.icons) && manifest.icons.length >= 3, "manifest.icons が不足しています");
assert(
  Array.isArray(manifest.shortcuts) &&
    manifest.shortcuts.some((item) => item.url === "./?screen=backupCenter"),
  "manifest.shortcuts にバックアップ導線がありません",
);
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
const contentManifest = readJson("public/content/manifest.json");
const contentDataset = readJson("public/content/questions/lpic-101.json");
assert(contentManifest.schemaVersion === 1, "問題マスターmanifestのschemaVersionが不正です");
assert(contentDataset.schemaVersion === 1, "問題データセットのschemaVersionが不正です");
assert(contentManifest.datasets?.[0]?.id === contentDataset.datasetId, "問題マスターのdataset IDが一致しません");
assert(contentManifest.datasets?.[0]?.version === contentDataset.version, "問題マスターのdataset versionが一致しません");
assert(contentManifest.datasets?.[0]?.questionCount === contentDataset.questions?.length, "問題マスターの件数が一致しません");
const clientSources = [
  "src/services/contentPullRequestApi.ts",
  "src/pages/QuestionMasterPage.tsx",
].map((path) => readFileSync(path, "utf8")).join("\n");
assert(!/GITHUB_PRIVATE_KEY|GITHUB_INSTALLATION_ID|BEGIN RSA PRIVATE KEY/u.test(clientSources), "GitHub秘密情報をクライアントへ含めてはいけません");
for (const [path, tokens] of [
  ["src/main.tsx", ["<ErrorBoundary>", "<ConcurrentUpdateNotice />", "<PwaUpdatePrompt />"]],
  ["public/sw.js", ["CACHE_PREFIX}v23", "SKIP_WAITING", "matchAll", "Promise.allSettled", "navigationPreload", "networkFirstContent", "content/", "pwa-maskable-512x512.png", "Cache Storageへの保存はベストエフォート"]],
  ["src/services/fullBackupService.ts", ["CURRENT_BACKUP_VERSION = 10", "FNV-1A-32", "auditStorage", "compareFullBackup", "downloadBackupFile", "questionQualityProposals"]],
  ["src/pages/BackupCenterPage.tsx", ["storage-health-badge", "整合性チェック済み", "端末データの保持を強化", "現在データとの差分集計", "study-quiz-pre-restore"]],
  ["src/components/StudyFilterPanel.tsx", ["masteryFilters", "questionModes", "horizontal-option-scroller"]],
  ["src/components/ConfirmDialog.tsx", ["role=\"alertdialog\"", "aria-modal=\"true\"", "createPortal", "previousFocusRef", "FOCUSABLE_SELECTOR"]],
  ["src/pages/QuestionManagementPage.tsx", ["<ConfirmDialog", "QUESTION_LIMITS", "questionValidationErrors"]],
  ["src/services/questionValidation.ts", ["longText: 20_000", "maxTags: 30", "maxAcceptedAnswers: 100"]],
  ["src/services/questionAnswerModel.ts", ["QuestionAnswerDefinition", "answerDefinitionOf", "responseToHistoryFields", "answerDefinitionForExternalUse", "createStudyHistoryQuestionSnapshot", "historyQuestionText"]],
  ["src/services/similarQuestionService.ts", ["answerNumbers", "acceptedAnswers", "questionTypeLabel"]],
  ["src/services/questionQualityService.ts", ["study-quiz-question-quality-input", "study-quiz-question-quality-proposals", "study-quiz-question-seed-updates"]],
  ["src/pages/QuestionQualityReviewPage.tsx", ["変更前の問題文", "提案後の問題文", "適用済みの初期データ更新JSONを出力"]],
  ["src/App.css", ["overflow-x: auto", "scroll-snap-type: x proximity"]],
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
