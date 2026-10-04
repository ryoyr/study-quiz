export type MainTab = 'home' | 'study' | 'questions' | 'analytics' | 'settings';
type Props = { active: MainTab; onChange: (tab: MainTab) => void };
const items: Array<{ id: MainTab; icon: string; label: string }> = [
  { id: 'home', icon: '⌂', label: 'ホーム' }, { id: 'study', icon: '▤', label: '学習' },
  { id: 'questions', icon: '☷', label: '一覧' }, { id: 'analytics', icon: '▥', label: '分析' },
  { id: 'settings', icon: '⚙', label: '設定' },
];
export default function BottomNavigation({ active, onChange }: Props) {
  return <nav className="bottom-nav" aria-label="メインメニュー">{items.map((item) => <button key={item.id} type="button" className={active === item.id ? 'is-active' : ''} onClick={() => onChange(item.id)}><span>{item.icon}</span><small>{item.label}</small></button>)}</nav>;
}
