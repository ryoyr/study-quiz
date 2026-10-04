
import type { StudyHistory } from '../types/StudyHistory';
const STORAGE_KEY='study-quiz-answer-history-v1';
const normalize=(value: Partial<StudyHistory>): StudyHistory => ({
 id:value.id ?? crypto.randomUUID(), questionId:value.questionId ?? '', category:value.category ?? '', selectedIndex:value.selectedIndex ?? -1,
 correct:value.correct ?? false, answeredAt:value.answeredAt ?? new Date().toISOString(),
 responseTimeSeconds:Number.isFinite(value.responseTimeSeconds) ? Math.max(0,value.responseTimeSeconds ?? 0) : 0,
 instantScore:Number.isFinite(value.instantScore) ? Math.min(1,Math.max(0,value.instantScore ?? 0)) : 0
});
export const loadHistory=():StudyHistory[]=>{try{const value=localStorage.getItem(STORAGE_KEY);if(!value)return[];const parsed:unknown=JSON.parse(value);return Array.isArray(parsed)?parsed.map((item)=>normalize(item as Partial<StudyHistory>)):[];}catch{return[];}};
export const saveHistory=(history:StudyHistory[]):void=>localStorage.setItem(STORAGE_KEY,JSON.stringify(history));
export const clearHistory=():void=>localStorage.removeItem(STORAGE_KEY);
