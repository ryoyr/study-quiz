import AppIcon, { type AppIconName } from "./AppIcon";

type Props = {
  icon: AppIconName;
  title: string;
  description: string;
  badge?: string;
  tone?: "blue" | "green" | "amber" | "violet" | "slate";
  onClick: () => void;
};

export default function FeatureLink({
  icon,
  title,
  description,
  badge,
  tone = "blue",
  onClick,
}: Props) {
  return (
    <button
      className={`feature-link tone-${tone}`}
      type="button"
      onClick={onClick}
      aria-label={`${title} — ${description}${badge ? `（${badge}）` : ""}`}
    >
      <span className="feature-link-icon" aria-hidden="true">
        <AppIcon name={icon} />
      </span>
      <span className="feature-link-copy">
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      {badge && <b>{badge}</b>}
      <span className="feature-link-arrow" aria-hidden="true">
        <AppIcon name="chevron-right" />
      </span>
    </button>
  );
}

