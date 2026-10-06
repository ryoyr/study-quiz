import { useId } from "react";
import AppIcon, { type AppIconName } from "./AppIcon";
import { COLOR_MODE_OPTIONS, VISUAL_THEME_OPTIONS } from "../services/themeService";
import type { ThemePreference, VisualTheme } from "../types/Setup";

type Props = {
  colorMode: ThemePreference;
  visualTheme: VisualTheme;
  onColorModeChange: (value: ThemePreference) => void;
  onVisualThemeChange: (value: VisualTheme) => void;
  error?: string;
  errorId?: string;
};

const modeIcon: Record<ThemePreference, AppIconName> = {
  system: "monitor",
  light: "sun",
  dark: "moon",
};

export default function ThemePicker({
  colorMode,
  visualTheme,
  onColorModeChange,
  onVisualThemeChange,
  error,
  errorId,
}: Props) {
  const titleId = useId();
  const visualName = useId();
  const colorModeName = useId();
  return (
    <section className="theme-picker" aria-labelledby={titleId}>
      <div className="theme-picker-heading">
        <span className="theme-picker-icon" aria-hidden="true"><AppIcon name="palette" /></span>
        <div>
          <h3 id={titleId}>表示テーマ</h3>
          <p>配色テーマと画面の明るさは別々に選べます。</p>
        </div>
      </div>

      <fieldset className="appearance-fieldset">
        <legend>配色テーマ</legend>
        <div className="visual-theme-grid">
          {VISUAL_THEME_OPTIONS.map((option) => (
            <label
              key={option.id}
              className={visualTheme === option.id ? "visual-theme-card is-selected" : "visual-theme-card"}
            >
              <input
                type="radio"
                name={visualName}
                value={option.id}
                checked={visualTheme === option.id}
                onChange={() => onVisualThemeChange(option.id)}
              />
              <span className="theme-swatches" aria-hidden="true">
                {option.colors.map((color) => <i key={color} style={{ backgroundColor: color }} />)}
              </span>
              <span className="visual-theme-copy">
                <strong>{option.label}</strong>
                <small>{option.description}</small>
              </span>
              <span className="theme-check" aria-hidden="true">✓</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="appearance-fieldset color-mode-fieldset" aria-describedby={error ? errorId : undefined}>
        <legend>明るさ</legend>
        <div className="color-mode-options">
          {COLOR_MODE_OPTIONS.map((option) => (
            <label key={option.id} className={colorMode === option.id ? "color-mode-option is-selected" : "color-mode-option"}>
              <input
                type="radio"
                name={colorModeName}
                value={option.id}
                checked={colorMode === option.id}
                onChange={() => onColorModeChange(option.id)}
              />
              <AppIcon name={modeIcon[option.id]} />
              <span><strong>{option.label}</strong><small>{option.description}</small></span>
            </label>
          ))}
        </div>
      </fieldset>
      {error && <span id={errorId} className="field-error">{error}</span>}
    </section>
  );
}
