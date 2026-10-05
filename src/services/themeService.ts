import type { ThemePreference } from "../types/Setup";

export const applyTheme = (theme: ThemePreference): void => {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.dataset.theme = theme;

  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0f172a" : "#2563eb");
};
