
import type { StudyStreak } from '../services/streakService';
type Props = { streak: StudyStreak };
export default function StreakCard({ streak }: Props) {
  const status = streak.studiedToday ? '本日学習済み' : streak.reservedToday ? '本日は学習しない日' : '本日未学習';
  const message = streak.studiedToday
    ? '今日の学習記録は反映済みです。'
    : streak.reservedToday
      ? '本日は予約日のため、学習しなくても連続記録は途切れません。'
      : streak.currentDays > 0
        ? '今日学習すると連続記録を更新できます。'
        : '今日から新しい連続記録を始められます。';
  return <section className={streak.studiedToday ? 'streak-card is-active' : streak.reservedToday ? 'streak-card is-reserved' : 'streak-card'}><div className="streak-main"><div className="streak-flame" aria-hidden="true">●</div><div><span>連続学習</span><strong>{streak.currentDays}日</strong></div><b>{status}</b></div><div className="streak-details"><span>最長記録 <strong>{streak.longestDays}日</strong></span><span>累計学習日 <strong>{streak.totalStudyDays}日</strong></span></div>{streak.skippedReservedDays > 0 && <div className="streak-reserved-note">連続期間内の学習しない日: {streak.skippedReservedDays}日</div>}<p>{message}</p></section>;
}
