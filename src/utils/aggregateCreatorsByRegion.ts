import { connectToDatabase } from '@/app/lib/mongoose';
import UserModel from '@/app/models/User';
import { logger } from '@/app/lib/logger';
import { getStatesByRegion } from '@/data/brazilRegions';

export interface CityBreakdown {
  count: number;
  gender: Record<string, number>;
  age: Record<string, number>;
}

export interface StateBreakdown {
  state: string;
  count: number;
  gender: Record<string, number>;
  age: Record<string, number>;
  cities: Record<string, CityBreakdown>;
}

interface Filters {
  gender?: string;
  minAge?: number;
  maxAge?: number;
  region?: string;
}

function getAge(date: Date): number {
  const diff = Date.now() - date.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}

function getAgeGroup(age: number): string {
  if (age < 18) return '0-17';
  if (age <= 24) return '18-24';
  if (age <= 34) return '25-34';
  if (age <= 44) return '35-44';
  return '45+';
}

export default async function aggregateCreatorsByRegion(filters: Filters = {}): Promise<StateBreakdown[]> {
  const TAG = '[aggregateCreatorsByRegion]';
  await connectToDatabase();

  const query: any = {}; // Temporariamente busca todos os usuários
  if (filters.gender) {
    query.gender = filters.gender;
  }
  if (filters.region) {
    const states = getStatesByRegion(filters.region);
    if (states.length > 0) {
      query['location.state'] = { $in: states };
    }
  }

  const docs = await UserModel.find(query)
    .select('location.state location.city birthDate gender')
    .lean();

  const result: Record<string, StateBreakdown> = {};

  for (const u of docs) {
    const state = u.location?.state;
    if (!state) continue;

    const gender = u.gender || 'other';

    let ageGroup: string | null = null;
    if (u.birthDate instanceof Date) {
      const age = getAge(u.birthDate);
      if (filters.minAge && age < filters.minAge) continue;
      if (filters.maxAge && age > filters.maxAge) continue;
      ageGroup = getAgeGroup(age);
    } else if (filters.minAge || filters.maxAge) {
      continue; // cannot satisfy age filter without birthDate
    }

    if (!result[state]) {
      result[state] = { state, count: 0, gender: {}, age: {}, cities: {} };
    }
    const stateInfo = result[state];
    stateInfo.count += 1;
    stateInfo.gender[gender] = (stateInfo.gender[gender] || 0) + 1;
    if (ageGroup) {
      stateInfo.age[ageGroup] = (stateInfo.age[ageGroup] || 0) + 1;
    }

    const city = u.location?.city || 'Desconhecida';
    if (!stateInfo.cities[city]) {
      stateInfo.cities[city] = { count: 0, gender: {}, age: {} };
    }
    const cityInfo = stateInfo.cities[city];
    cityInfo.count += 1;
    cityInfo.gender[gender] = (cityInfo.gender[gender] || 0) + 1;
    if (ageGroup) {
      cityInfo.age[ageGroup] = (cityInfo.age[ageGroup] || 0) + 1;
    }
  }

  logger.info(`${TAG} aggregated ${docs.length} users`);
  return Object.values(result);
}
