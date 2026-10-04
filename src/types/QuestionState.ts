

export type MasteryLevel='UNLEARNED'|'LEARNING'|'MASTERED';
import type { StoredFsrsCard } from '../services/fsrsAdapter';
export interface QuestionState { questionId:string; correctCount:number; incorrectCount:number; totalCount:number; averageResponseTimeSeconds:number; recentResponseTimeSeconds:number; averageInstantScore:number; recentInstantScore:number; recentIncorrect:boolean; lastAnsweredAt:string|null; masteryLevel:MasteryLevel; fsrsCard:StoredFsrsCard|null; nextReviewAt:string|null; fsrsStability:number; fsrsDifficulty:number; }
