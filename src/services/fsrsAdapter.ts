import {
  createEmptyCard,
  fsrs,
  Rating,
  type Card,
  type CardInput,
  type Grade,
} from "ts-fsrs";
export type FsrsRating = "AGAIN" | "HARD" | "GOOD" | "EASY";
export interface StoredFsrsCard {
  due: string;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  state: number;
  lastReview: string | null;
}
const scheduler = fsrs({
  request_retention: 0.9,
  maximum_interval: 36500,
  enable_fuzz: false,
  enable_short_term: true,
  learning_steps: ["1m", "10m"],
  relearning_steps: ["10m"],
});
const ratingMap: Record<FsrsRating, Grade> = {
  AGAIN: Rating.Again,
  HARD: Rating.Hard,
  GOOD: Rating.Good,
  EASY: Rating.Easy,
};
const toStored = (card: Card): StoredFsrsCard => ({
  due: card.due.toISOString(),
  stability: card.stability,
  difficulty: card.difficulty,
  elapsedDays: card.elapsed_days,
  scheduledDays: card.scheduled_days,
  learningSteps: card.learning_steps,
  reps: card.reps,
  lapses: card.lapses,
  state: card.state,
  lastReview: card.last_review?.toISOString() ?? null,
});
const toInput = (card: StoredFsrsCard): CardInput => ({
  due: card.due,
  stability: card.stability,
  difficulty: card.difficulty,
  elapsed_days: card.elapsedDays,
  scheduled_days: card.scheduledDays,
  learning_steps: card.learningSteps,
  reps: card.reps,
  lapses: card.lapses,
  state: card.state,
  last_review: card.lastReview,
});
const isFiniteNonNegative = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;
const isNonNegativeInteger = (value: unknown): value is number =>
  Number.isInteger(value) && Number(value) >= 0;
const isTimestamp = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T/u.test(value) &&
  Number.isFinite(Date.parse(value));

export const isStoredFsrsCard = (value: unknown): value is StoredFsrsCard => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const card = value as Partial<StoredFsrsCard>;
  return (
    isTimestamp(card.due) &&
    (card.lastReview === null || isTimestamp(card.lastReview)) &&
    isFiniteNonNegative(card.stability) &&
    isFiniteNonNegative(card.difficulty) &&
    isNonNegativeInteger(card.elapsedDays) &&
    isNonNegativeInteger(card.scheduledDays) &&
    isNonNegativeInteger(card.learningSteps) &&
    isNonNegativeInteger(card.reps) &&
    isNonNegativeInteger(card.lapses) &&
    Number.isInteger(card.state) &&
    Number(card.state) >= 0 &&
    Number(card.state) <= 3
  );
};
export const scheduleFsrs = (
  stored: StoredFsrsCard | null,
  rating: FsrsRating,
  now = new Date(),
): StoredFsrsCard => {
  const card = stored ? toInput(stored) : createEmptyCard(now);
  return toStored(scheduler.next(card, now, ratingMap[rating]).card);
};
export const fsrsRatingLabel = (rating: FsrsRating): string =>
  ({ AGAIN: "忘れた", HARD: "難しい", GOOD: "思い出せた", EASY: "簡単" })[
    rating
  ];
