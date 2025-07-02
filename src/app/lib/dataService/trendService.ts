import { logger } from '@/app/lib/logger';
import { TimePeriod } from '@/app/lib/constants/timePeriods';
import { FollowerTrendData, ReachEngagementTrendData } from './types';

const SERVICE_TAG = '[dataService][trendService]';
const BASE_URL = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || '';

export async function getFollowerTrend(
  userId: string,
  timePeriod: TimePeriod = 'last_30_days',
  granularity: 'daily' | 'monthly' = 'daily'
): Promise<FollowerTrendData> {
  const TAG = `${SERVICE_TAG}[getFollowerTrend]`;
  const url = `${BASE_URL}/api/v1/users/${userId}/trends/followers?timePeriod=${timePeriod}&granularity=${granularity}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      logger.error(`${TAG} HTTP ${res.status} ao buscar seguidores.`);
      throw new Error(`Request failed with status ${res.status}`);
    }
    return (await res.json()) as FollowerTrendData;
  } catch (err) {
    logger.error(`${TAG} Erro ao chamar API`, err);
    throw new Error('Falha ao buscar tendência de seguidores');
  }
}

export async function getReachEngagementTrend(
  userId: string,
  timePeriod: TimePeriod = 'last_30_days',
  granularity: 'daily' | 'weekly' = 'daily'
): Promise<ReachEngagementTrendData> {
  const TAG = `${SERVICE_TAG}[getReachEngagementTrend]`;
  const url = `${BASE_URL}/api/v1/users/${userId}/trends/reach-engagement?timePeriod=${timePeriod}&granularity=${granularity}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      logger.error(`${TAG} HTTP ${res.status} ao buscar alcance/engajamento.`);
      throw new Error(`Request failed with status ${res.status}`);
    }
    return (await res.json()) as ReachEngagementTrendData;
  } catch (err) {
    logger.error(`${TAG} Erro ao chamar API`, err);
    throw new Error('Falha ao buscar tendência de alcance/engajamento');
  }
}

export async function getFpcTrend(
  userId: string,
  format: string,
  proposal: string,
  context: string,
  timePeriod: TimePeriod = 'last_90_days',
  granularity: 'weekly' | 'monthly' = 'weekly'
) {
  const TAG = `${SERVICE_TAG}[getFpcTrend]`;
  const url = `${BASE_URL}/api/v1/users/${userId}/trends/fpc-history?format=${encodeURIComponent(format)}&proposal=${encodeURIComponent(proposal)}&context=${encodeURIComponent(context)}&timePeriod=${timePeriod}&granularity=${granularity}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      logger.error(`${TAG} HTTP ${res.status} ao buscar FPC trend.`);
      throw new Error(`Request failed with status ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    logger.error(`${TAG} Erro ao chamar API`, err);
    throw new Error('Falha ao buscar tendência FPC');
  }
}
