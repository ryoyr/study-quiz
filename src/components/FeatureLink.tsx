type Props = {
  icon: string;
  title: string;
  description: string;
  badge?: string;
  tone?: 'blue' | 'green' | 'amber' | 'violet' | 'slate';
  onClick: () => void;
};

export default function FeatureLink({ icon, title, description, badge, tone = 'blue', onClick }: Props) {
  return (
    <button className={`feature-link tone-${tone}`} type="button" onClick={onClick}>
      <span className="feature-link-icon" aria-hidden="true">{icon}</span>
      <span className="feature-link-copy">
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      {badge && <b>{badge}</b>}
      <span className="feature-link-arrow" aria-hidden="true">›</span>
    </button>
  );
}
