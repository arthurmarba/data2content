import { connectToDatabase } from '@/app/lib/mongoose';
import AudienceDemographicSnapshotModel from '@/app/models/demographics/AudienceDemographicSnapshot';
import UserModel from '@/app/models/User';
import { logger } from '@/app/lib/logger';
import { Types } from 'mongoose';
import { BRAZIL_CITY_TO_STATE_MAP, normalizeCityName } from '@/data/brazilCityToState';
import { getStatesByRegion } from '@/data/brazilRegions';
import { BRAZIL_STATE_POPULATION } from '@/data/brazilStatePopulation';

export interface CityBreakdown {
  count: number;
  gender: Record<string, number>;
  age: Record<string, number>;
}

export interface StateBreakdown {
  state: string;
  count: number;
  density?: number;
  gender: Record<string, number>;
  age: Record<string, number>;
  cities: Record<string, CityBreakdown>;
}

interface Filters {
  region?: string;
  gender?: 'F' | 'M' | 'U';
  ageRange?: '13-17' | '18-24' | '25-34' | '35-44' | '45-54' | '55-64' | '65+';
}

export default async function aggregateAudienceByRegion(
  filters: Filters = {},
  agencyId?: string
): Promise<StateBreakdown[]> {
  const TAG = '[aggregateAudienceByRegion]';
  await connectToDatabase();

  try {
    const pipeline: any[] = [];
    if (agencyId) {
      const agencyUserIds = await UserModel.find({ agency: new Types.ObjectId(agencyId) }).distinct('_id');
      if (!agencyUserIds.length) {
        return [];
      }
      pipeline.push({ $match: { user: { $in: agencyUserIds } } });
    }

    pipeline.push(
      { $sort: { user: 1, recordedAt: -1 } },
      { $group: { _id: '$user', latestSnapshotId: { $first: '$_id' } } },
      { $lookup: { from: 'audience_demographic_snapshots', localField: 'latestSnapshotId', foreignField: '_id', as: 'snapshot' } },
      { $unwind: '$snapshot' },
      { $replaceRoot: { newRoot: '$snapshot' } }
    );

    const latestSnapshots = await AudienceDemographicSnapshotModel.aggregate(pipeline);

    const stateResults: Record<string, StateBreakdown> = {};
    const allowedStates = filters.region ? new Set(getStatesByRegion(filters.region)) : null;

    for (const doc of latestSnapshots) {
      const followerDemographics = doc.demographics?.follower_demographics;
      if (!followerDemographics || !followerDemographics.city) continue;

      let demographicProportion = 1.0;

      if (filters.gender && followerDemographics.gender) {
        // --- CORREÇÃO APLICADA AQUI ---
        // Adiciona o tipo explícito 'number' ao acumulador 'sum'.
        const totalGenderFollowers = Object.values(followerDemographics.gender).reduce((sum: number, value) => sum + (typeof value === 'number' ? value : 0), 0);
        if (totalGenderFollowers > 0) {
          const genderCount = followerDemographics.gender[filters.gender] || 0;
          demographicProportion = genderCount / totalGenderFollowers;
        }
      } else if (filters.ageRange && followerDemographics.age) {
        // --- CORREÇÃO APLICADA AQUI ---
        // Adiciona o tipo explícito 'number' ao acumulador 'sum'.
        const totalAgeFollowers = Object.values(followerDemographics.age).reduce((sum: number, value) => sum + (typeof value === 'number' ? value : 0), 0);
        if (totalAgeFollowers > 0) {
          const ageCount = followerDemographics.age[filters.ageRange] || 0;
          demographicProportion = ageCount / totalAgeFollowers;
        }
      }
      
      for (const [originalCityName, count] of Object.entries(followerDemographics.city)) {
        if (typeof count !== 'number') continue;

        const estimatedCount = count * demographicProportion;
        if (estimatedCount === 0) continue;

        const cleanedCityName = (originalCityName.split(',')[0] ?? '').trim();
        const normalized = normalizeCityName(cleanedCityName);
        const stateAbbr = BRAZIL_CITY_TO_STATE_MAP[normalized];
        
        if (!stateAbbr || (allowedStates && !allowedStates.has(stateAbbr))) continue;

        if (!stateResults[stateAbbr]) {
          stateResults[stateAbbr] = {
            state: stateAbbr,
            count: 0,
            density: 0,
            gender: {},
            age: {},
            cities: {}
          };
        }

        const stateInfo = stateResults[stateAbbr]!;
        stateInfo.count += estimatedCount;

        if (!stateInfo.cities[originalCityName]) {
          stateInfo.cities[originalCityName] = { count: 0, gender: {}, age: {} };
        }
        stateInfo.cities[originalCityName]!.count += estimatedCount;
      }
    }

    for (const stateAbbr in stateResults) {
      const stateInfo = stateResults[stateAbbr]!;
      const population = BRAZIL_STATE_POPULATION[stateAbbr];
      if (population && population > 0) {
        stateInfo.density = (stateInfo.count / population);
      }
      stateInfo.count = Math.round(stateInfo.count);
      for(const city in stateInfo.cities){
          stateInfo.cities[city]!.count = Math.round(stateInfo.cities[city]!.count);
      }
    }

    logger.info(`${TAG} Agregados ${latestSnapshots.length} snapshots com filtros:`, filters);
    return Object.values(stateResults);

  } catch (error) {
    logger.error(`${TAG} Erro ao agregar dados de audiência`, error);
    throw new Error('Falha ao agregar dados de audiência.');
  }
}
