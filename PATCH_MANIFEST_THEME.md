# Theme Accessibility Patch Manifest

基準: `project_dump.txt` / Study Quiz v4.4.0

## 上書き対象

- `src/App.css`
- `src/components/LearningProgressCharts.tsx`
- `src/components/ThemePicker.tsx`
- `src/services/themeService.ts`
- `scripts/e2e-accessibility.mjs`
- `tests/themeAccessibility.test.ts`（新規）
- `APPLY_THEME_UPDATE.md`（新規）
- `THEME_ACCESSIBILITY_REPORT.md`（新規）
- `PATCH_MANIFEST_THEME.md`（新規）
- `SHA256SUMS_THEME.txt`（新規、配布ファイル整合性）

## 非変更対象

- `package.json` / `package-lock.json`
- 保存スキーマ、保存キー、移行処理、バックアップ形式
- Service Worker、Web Manifest、PWAアイコン
- 問題データ、画面遷移、学習ロジック、AI連携
