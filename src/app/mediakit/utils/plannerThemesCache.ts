import { PlannerUISlot } from '@/hooks/usePlannerData';

const cache = new Map<string, string[]>();

const buildKey = (slot: PlannerUISlot) => {
  const keyword = (slot.themeKeyword || '').trim() || 'any';
  const base = slot.slotId || `${slot.dayOfWeek}-${slot.blockStartHour}`;
  return `${base}-${keyword}`;
};

export function getCachedThemes(slot: PlannerUISlot): string[] | null {
  const key = buildKey(slot);
  if (!cache.has(key)) return null;
  return cache.get(key) || null;
}

export function setCachedThemes(slot: PlannerUISlot, themes: string[]) {
  const key = buildKey(slot);
  cache.set(key, themes);
}
