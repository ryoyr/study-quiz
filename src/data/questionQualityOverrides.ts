import type { Question } from "../types/Question";

/**
 * 適用済み品質提案を今後の新規環境へ反映する初期データ上書き。
 * `node tools/apply_question_seed_updates.mjs <seed-update-pack.json>`で更新する。
 */
export const questionQualityOverrides: Question[] = [];
