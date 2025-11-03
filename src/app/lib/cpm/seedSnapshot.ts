import { getDynamicCpmBySegment } from '@/app/lib/ai/cpmDynamicService';
import { INITIAL_CPM_SEED } from '@/app/lib/ai/initialCpmSeed';

export interface SeedSnapshot {
  snapshot: Record<string, number>;
  dynamicSegments: number;
  totalSegments: number;
}

export async function computeSeedSnapshot(): Promise<SeedSnapshot | null> {
  const map = await getDynamicCpmBySegment({ forceRefresh: true });
  const dynamicEntries = Object.entries(map).filter(([, entry]) => entry.source === 'dynamic');

  if (dynamicEntries.length === 0) {
    return null;
  }

  const snapshot: Record<string, number> = {};
  for (const [segment, entry] of dynamicEntries) {
    snapshot[segment] = Math.round(entry.value * 100) / 100;
  }

  for (const [segment, value] of Object.entries(INITIAL_CPM_SEED)) {
    if (!(segment in snapshot)) {
      snapshot[segment] = value;
    }
  }

  return {
    snapshot,
    dynamicSegments: dynamicEntries.length,
    totalSegments: Object.keys(snapshot).length,
  };
}
