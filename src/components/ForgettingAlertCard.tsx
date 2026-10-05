import type { ForgettingCandidate } from "../services/forgettingDetectionService";

type Props = {
  candidates: ForgettingCandidate[];
  onStart: () => void;
};

export default function ForgettingAlertCard({ candidates, onStart }: Props) {
  if (candidates.length === 0) {
    return (
      <section className="forgetting-card is-clear">
        <div>
          <span>忘れかけ検出</span>
          <strong>候補なし</strong>
        </div>
        <p>比較に必要な履歴が蓄積されると、成績悪化の候補を表示します。</p>
      </section>
    );
  }
  const top = candidates[0];
  return (
    <section className="forgetting-card">
      <div className="forgetting-heading">
        <div>
          <span>忘れかけ検出</span>
          <strong>{candidates.length}問を検出</strong>
        </div>
        <b>{top.reasons.join("・")}</b>
      </div>
      <p>
        最優先: {top.question.category} / {top.question.text}
      </p>
      <button type="button" className="forgetting-button" onClick={onStart}>
        忘れかけ候補を復習
      </button>
    </section>
  );
}

