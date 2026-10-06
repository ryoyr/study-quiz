import type { ThemePreference, VisualTheme } from "../types/Setup";

export const COLOR_MODE_OPTIONS = [
  { id: "system", label: "端末に合わせる", description: "OSの明暗設定へ自動追従" },
  { id: "light", label: "ライト", description: "明るい画面で固定" },
  { id: "dark", label: "ダーク", description: "暗い画面で固定" },
] as const satisfies ReadonlyArray<{ id: ThemePreference; label: string; description: string }>;

export const VISUAL_THEME_OPTIONS = [
  { id: "aurora", label: "オーロラ", description: "青と紫の立体的な標準テーマ", colors: ["#2563eb", "#7c3aed", "#06b6d4"] },
  { id: "focus", label: "フォーカス", description: "情報の優先度が明確な高コントラスト", colors: ["#1d4ed8", "#0f172a", "#f59e0b"] },
  { id: "forest", label: "フォレスト", description: "落ち着いて集中できる緑系", colors: ["#047857", "#0f766e", "#84cc16"] },
  { id: "sunset", label: "サンセット", description: "親しみやすい橙とローズ系", colors: ["#ea580c", "#e11d48", "#f59e0b"] },
  { id: "mono", label: "モノクロ", description: "装飾を抑えたシンプルな表示", colors: ["#334155", "#64748b", "#94a3b8"] },
] as const satisfies ReadonlyArray<{ id: VisualTheme; label: string; description: string; colors: readonly string[] }>;

export const isVisualTheme = (value: unknown): value is VisualTheme =>
  VISUAL_THEME_OPTIONS.some((option) => option.id === value);

export const visualThemeLabel = (theme: VisualTheme): string =>
  VISUAL_THEME_OPTIONS.find((option) => option.id === theme)?.label ?? "オーロラ";

export const colorModeLabel = (theme: ThemePreference): string =>
  COLOR_MODE_OPTIONS.find((option) => option.id === theme)?.label ?? "端末に合わせる";

export const applyTheme = (
  colorMode: ThemePreference,
  visualTheme: VisualTheme = "aurora",
): void => {
  const root = document.documentElement;
  if (colorMode === "system") root.removeAttribute("data-theme");
  else root.dataset.theme = colorMode;
  root.dataset.visualTheme = visualTheme;

  const dark =
    colorMode === "dark" ||
    (colorMode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const themeColor: Record<VisualTheme, { light: string; dark: string }> = {
    aurora: { light: "#2563eb", dark: "#111827" },
    focus: { light: "#1d4ed8", dark: "#0b1220" },
    forest: { light: "#047857", dark: "#071a18" },
    sunset: { light: "#ea580c", dark: "#21100d" },
    mono: { light: "#334155", dark: "#111827" },
  };
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", dark ? themeColor[visualTheme].dark : themeColor[visualTheme].light);
};
