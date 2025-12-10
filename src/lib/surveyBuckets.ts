import { MonetizationStatus } from '@/types/landing';

export function bucketFollowers(count?: number | null) {
  if (count == null) return 'Sem dado';
  if (count < 1000) return '<1k';
  if (count < 5000) return '1k-5k';
  if (count < 10000) return '5k-10k';
  if (count < 50000) return '10k-50k';
  if (count < 100000) return '50k-100k';
  if (count < 500000) return '100k-500k';
  if (count < 1000000) return '500k-1M';
  return '1M+';
}

export function bucketEngagement(engagementPct?: number | null) {
  if (engagementPct == null) return 'Sem dado';
  if (engagementPct < 1) return '<1%';
  if (engagementPct < 2) return '1-2%';
  if (engagementPct < 3) return '2-3%';
  if (engagementPct < 5) return '3-5%';
  if (engagementPct < 8) return '5-8%';
  return '8%+';
}

export function bucketReach(reach?: number | null) {
  if (reach == null) return 'Sem dado';
  if (reach < 1000) return '<1k';
  if (reach < 5000) return '1k-5k';
  if (reach < 10000) return '5k-10k';
  if (reach < 50000) return '10k-50k';
  if (reach < 100000) return '50k-100k';
  return '100k+';
}

export function bucketGrowth(growthPct?: number | null) {
  if (growthPct == null) return 'Sem dado';
  if (growthPct < -5) return '<-5%';
  if (growthPct < 0) return '-5% a 0%';
  if (growthPct < 5) return '0-5%';
  if (growthPct < 10) return '5-10%';
  if (growthPct < 20) return '10-20%';
  return '20%+';
}

export function monetizationLabel(status: MonetizationStatus | null, priceRange: string | null) {
  if (!status || status === 'nunca-sem-interesse') return 'Não monetiza';
  if (status === 'nunca-quero') return 'Quer começar';
  return priceRange ? `Sim (${priceRange})` : 'Sim';
}

export function priceRangeMidpoint(range?: string | null) {
  if (!range) return null;
  const map: Record<string, number> = {
    permuta: 0,
    '0-500': 250,
    '500-1500': 1000,
    '1500-3000': 2250,
    '3000-5000': 4000,
    '5000-8000': 6500,
    '8000-plus': 10000,
    '3000-plus': 4000,
  };
  return map[range] ?? null;
}
