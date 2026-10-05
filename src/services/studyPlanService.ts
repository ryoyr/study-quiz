

import type { Setup } from '../types/Setup';

const dateOnly = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const daysUntil = (date: string, now: Date): number => {
  const target = new Date(`${date}T00:00:00`);
  const base = new Date(now);
  base.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - base.getTime()) / 86400000);
};

const countFutureReservedDates = (setup: Setup, now: Date): number => {
  const today = dateOnly(now);
  return [...new Set(setup.reservedDates ?? [])]
    .filter((date) => date >= today && date < setup.examDate)
    .length;
};

export const calculateRequiredNewCount = (remaining: number, setup: Setup, now = new Date()) => {
  const effectiveDays = Math.max(1, daysUntil(setup.examDate, now) - countFutureReservedDates(setup, now));
  if (remaining === 0) return { effectiveDays, requiredNewCount: 0 };
  const base = Math.ceil(remaining / effectiveDays);
  const buffered = Math.ceil(base * (1 + setup.bufferRate / 100));
  const requiredNewCount = Math.min(remaining, setup.dailyNewLimit, buffered);
  return { effectiveDays, requiredNewCount };
};

