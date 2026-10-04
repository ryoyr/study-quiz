import type { StudyHistory } from '../types/StudyHistory'

const STORAGE_KEY = 'study-quiz-answer-history-v1'

export const loadHistory = (): StudyHistory[] => {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    if (!value) return []

    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? (parsed as StudyHistory[]) : []
  } catch {
    return []
  }
}

export const saveHistory = (history: StudyHistory[]): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
}

export const clearHistory = (): void => {
  localStorage.removeItem(STORAGE_KEY)
}
