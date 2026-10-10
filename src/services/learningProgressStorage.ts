import type { QuestionState } from "../types/QuestionState";
import type { StudyHistory } from "../types/StudyHistory";
import type { ActiveSessionSnapshot } from "./activeSessionStorage";
import { STORAGE_KEYS } from "./storageKeyRegistry.ts";
import {
  executeStorageTransaction,
  type StorageLike,
} from "./storageTransaction.ts";

const HISTORY_KEY = STORAGE_KEYS.answerHistory;
const QUESTION_STATES_KEY = STORAGE_KEYS.questionStates;
const ACTIVE_SESSION_KEY = STORAGE_KEYS.activeSession;

export interface LearningProgressSnapshot {
  history: StudyHistory[];
  questionStates: QuestionState[];
  activeSession: ActiveSessionSnapshot | null;
}

/**
 * 1回答で変化する履歴・FSRS状態・中断位置を1回の論理トランザクションとして保存する。
 */
export const saveLearningProgress = (
  snapshot: LearningProgressSnapshot,
  storage?: StorageLike,
): void => {
  executeStorageTransaction(
    [
      { key: HISTORY_KEY, value: JSON.stringify(snapshot.history) },
      {
        key: QUESTION_STATES_KEY,
        value: JSON.stringify(snapshot.questionStates),
      },
      {
        key: ACTIVE_SESSION_KEY,
        value: snapshot.activeSession
          ? JSON.stringify(snapshot.activeSession)
          : null,
      },
    ],
    storage,
  );
};
