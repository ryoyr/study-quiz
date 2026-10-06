import type { ThemePreference, VisualTheme } from "../types/Setup";

export const COLOR_MODE_OPTIONS = [
  { id: "system", label: "端末に合わせる", description: "OSの明暗設定へ自動追従" },
  { id: "light", label: "ライト", description: "明るい画面で固定" },
  { id: "dark", label: "ダーク", description: "暗い画面で固定" },
] as const satisfies ReadonlyArray<{ id: ThemePreference; label: string; description: string }>;

export const VISUAL_THEME_OPTIONS = [
  { id: "aurora", label: "オーロラ", description: "青と紫の立体的な標準テーマ" },
  { id: "focus", label: "フォーカス", description: "情報の優先度が明確な高コントラスト" },
  { id: "forest", label: "フォレスト", description: "落ち着いて集中できる緑系" },
  { id: "sunset", label: "サンセット", description: "親しみやすい橙とローズ系" },
  { id: "mono", label: "モノクロ", description: "装飾を抑えたシンプルな表示" },
] as const satisfies ReadonlyArray<{ id: VisualTheme; label: string; description: string }>;

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

  const themeColor = window.getComputedStyle(root).getPropertyValue("--app-bg").trim();
  if (themeColor) {
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", themeColor);
  }
};
