


import { createEmptyCard, fsrs, Rating, type Card, type CardInput, type Grade } from 'ts-fsrs';
export type FsrsRating='AGAIN'|'HARD'|'GOOD'|'EASY';
export interface StoredFsrsCard {due:string;stability:number;difficulty:number;elapsedDays:number;scheduledDays:number;learningSteps:number;reps:number;lapses:number;state:number;lastReview:string|null;}
const scheduler=fsrs({request_retention:.9,maximum_interval:36500,enable_fuzz:false,enable_short_term:true,learning_steps:['1m','10m'],relearning_steps:['10m']});
const ratingMap:Record<FsrsRating,Grade>={AGAIN:Rating.Again,HARD:Rating.Hard,GOOD:Rating.Good,EASY:Rating.Easy};
const toStored=(card:Card):StoredFsrsCard=>({due:card.due.toISOString(),stability:card.stability,difficulty:card.difficulty,elapsedDays:card.elapsed_days,scheduledDays:card.scheduled_days,learningSteps:card.learning_steps,reps:card.reps,lapses:card.lapses,state:card.state,lastReview:card.last_review?.toISOString()??null});
const toInput=(card:StoredFsrsCard):CardInput=>({due:card.due,stability:card.stability,difficulty:card.difficulty,elapsed_days:card.elapsedDays,scheduled_days:card.scheduledDays,learning_steps:card.learningSteps,reps:card.reps,lapses:card.lapses,state:card.state,last_review:card.lastReview});
export const scheduleFsrs=(stored:StoredFsrsCard|null,rating:FsrsRating,now=new Date()):StoredFsrsCard=>{const card=stored?toInput(stored):createEmptyCard(now);return toStored(scheduler.next(card,now,ratingMap[rating]).card);};
export const fsrsRatingLabel=(rating:FsrsRating):string=>({AGAIN:'忘れた',HARD:'難しい',GOOD:'思い出せた',EASY:'簡単'}[rating]);
