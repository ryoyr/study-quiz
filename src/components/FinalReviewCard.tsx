import type { FinalReviewPlan } from "../services/finalReviewService";
type Props = {
  plan: FinalReviewPlan;
  remainingDays: number;
  onStart: () => void;
};
export default function FinalReviewCard({
  plan,
  remainingDays,
  onStart,
}: Props) {
  return (
    <section
      className={`final-review-card strategy-${plan.strategy.toLowerCase()}`}
    >
      <div className="final-review-heading">
        <div>
          <span>試験戦略: {plan.strategyLabel}</span>
          <strong>
            {plan.questions.length}問 / 約{plan.estimatedMinutes}分
          </strong>
        </div>
        <b>{remainingDays >= 0 ? `残り${remainingDays}日` : "試験日経過"}</b>
      </div>
      <p className="final-review-strategy-text">{plan.strategyDescription}</p>
      <div className="final-review-details">
        <span>
          高ウェイト<strong>{plan.highWeightCount}問</strong>
        </span>
        <span>
          弱点<strong>{plan.weakCount}問</strong>
        </span>
        <span>
          忘れかけ<strong>{plan.forgettingCount}問</strong>
        </span>
        <span>
          未学習<strong>{plan.unlearnedCount}問</strong>
        </span>
      </div>
      <button
        type="button"
        className="final-review-button"
        disabled={plan.questions.length === 0}
        onClick={onStart}
      >
        この戦略で学習開始
      </button>
    </section>
  );
}

