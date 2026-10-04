

import type { Question } from '../types/Question';
import { questions as seedQuestions } from '../data/questions';
const STORAGE_KEY='study-quiz-questions-v1';
export const loadQuestions=():Question[]=>{try{const raw=localStorage.getItem(STORAGE_KEY);if(!raw){saveQuestions(seedQuestions);return [...seedQuestions];}const parsed:unknown=JSON.parse(raw);return Array.isArray(parsed)?parsed as Question[]:[...seedQuestions];}catch{return [...seedQuestions];}};
export const saveQuestions=(items:Question[]):void=>localStorage.setItem(STORAGE_KEY,JSON.stringify(items));
