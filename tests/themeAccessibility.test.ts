import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync("src/App.css", "utf8");
const marker = "/* v4.5 theme completion";
const semanticCss = css.slice(css.indexOf(marker));

type Tokens = Record<string, string>;

const parseBlock = (selector: string): Tokens => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = semanticCss.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "s"));
  assert.ok(match, `テーマ定義がありません: ${selector}`);
  return Object.fromEntries(
    [...match[1].matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{6})/g)].map((item) => [item[1], item[2]]),
  );
};

const luminance = (hex: string): number => {
  const values = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255);
  const [red, green, blue] = values.map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

const contrast = (foreground: string, background: string): number => {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
};

const THEMES = ["aurora", "focus", "forest", "sunset", "mono"] as const;
const baseLight = parseBlock(':root,\n:root[data-visual-theme="aurora"]');
const baseDark = parseBlock(':root[data-theme="dark"]');

const tokensFor = (theme: (typeof THEMES)[number], mode: "light" | "dark"): Tokens => ({
  ...baseLight,
  ...(theme === "aurora" ? {} : parseBlock(`:root[data-visual-theme="${theme}"]`)),
  ...(mode === "dark" ? baseDark : {}),
  ...(mode === "dark" ? parseBlock(`:root[data-theme="dark"][data-visual-theme="${theme}"]`) : {}),
});

const expectContrast = (
  tokens: Tokens,
  foreground: string,
  background: string,
  minimum: number,
  label: string,
): void => {
  assert.ok(tokens[foreground], `${label}: ${foreground} がありません`);
  assert.ok(tokens[background], `${label}: ${background} がありません`);
  const ratio = contrast(tokens[foreground], tokens[background]);
  assert.ok(ratio >= minimum, `${label}: ${ratio.toFixed(2)}:1 < ${minimum}:1`);
};

test("全テーマのライト・ダークトークンがWCAGコントラスト目安を満たす", () => {
  for (const theme of THEMES) {
    for (const mode of ["light", "dark"] as const) {
      const tokens = tokensFor(theme, mode);
      const label = `${theme}/${mode}`;
      for (const foreground of ["--text-main", "--text-strong", "--text-muted", "--text-link"]) {
        expectContrast(tokens, foreground, "--surface-solid", 4.5, `${label} ${foreground}`);
      }
      expectContrast(tokens, "--text-on-accent", "--button-primary", 4.5, `${label} primary button`);
      expectContrast(tokens, "--focus-color", "--surface-solid", 3, `${label} focus`);
      expectContrast(tokens, "--line-control", "--surface-solid", 3, `${label} control border`);
      for (const status of ["success", "warning", "danger", "info"] as const) {
        expectContrast(tokens, `--${status}-text`, `--${status}-soft`, 4.5, `${label} ${status}`);
      }
      for (const series of ["answers", "unlearned", "learning", "mastered"] as const) {
        expectContrast(tokens, `--chart-${series}`, "--surface-soft", 3, `${label} chart ${series}`);
      }
    }
  }
});

test("表示色はCSSカスタムプロパティに集約され、状態を色だけで表現しない", () => {
  const beforeSemanticLayer = css.slice(0, css.indexOf(marker));
  const declarations = [...beforeSemanticLayer.matchAll(/([\w-]+)\s*:\s*([^;{}]+)/g)]
    .filter((match) => !match[1].startsWith("--"));
  const rawColors = declarations.flatMap((match) =>
    match[2].match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g) ?? [],
  );
  assert.deepEqual(rawColors, []);
  assert.match(css, /chart-series-unlearned[^}]*stroke-dasharray/s);
  assert.match(css, /chart-series-learning[^}]*stroke-dasharray/s);
  assert.match(css, /chart-series-mastered[^}]*stroke-dasharray/s);
  assert.match(css, /@media \(forced-colors: active\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

