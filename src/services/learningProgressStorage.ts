import type { QuestionState } from '../types/QuestionState';
import type { StudyHistory } from '../types/StudyHistory';
import type { ActiveSessionSnapshot } from './activeSessionStorage';
import { executeStorageTransaction, type StorageLike } from './storageTransaction.ts';

const HISTORY_KEY = 'study-quiz-answer-history-v1';
const QUESTION_STATES_KEY = 'study-quiz-question-states-v1';
const ACTIVE_SESSION_KEY = 'study-quiz-active-session-v1';

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
  executeStorageTransaction([
    { key: HISTORY_KEY, value: JSON.stringify(snapshot.history) },
    { key: QUESTION_STATES_KEY, value: JSON.stringify(snapshot.questionStates) },
    {
      key: ACTIVE_SESSION_KEY,
      value: snapshot.activeSession ? JSON.stringify(snapshot.activeSession) : null,
    },
  ], storage);
};
