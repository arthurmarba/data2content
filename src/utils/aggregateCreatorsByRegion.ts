import UserModel from '@/app/models/User';
import { connectToDatabase } from '@/app/lib/mongoose';

type RegionFilter = { region?: 'Norte' | 'Nordeste' | 'Centro-Oeste' | 'Sudeste' | 'Sul' };

type RegionMap = Record<string, string[]>;

const REGION_TO_STATES: RegionMap = {
  Norte: ['AC', 'AP', 'AM', 'PA', 'RO', 'RR', 'TO'],
  Nordeste: ['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE'],
  'Centro-Oeste': ['DF', 'GO', 'MT', 'MS'],
  Sudeste: ['ES', 'MG', 'RJ', 'SP'],
  Sul: ['PR', 'RS', 'SC'],
};

type CityInfo = {
  count: number;
  genders: Record<string, number>;
  ages: number[];
};

type RegionResult = {
  state: string;
  count: number;
  cities: Record<string, CityInfo>;
};

function calcAge(birthDate?: Date | string | null): number | null {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  const ageDate = new Date(diff);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
}

export default async function aggregateCreatorsByRegion(
  filter: RegionFilter = {}
): Promise<RegionResult[]> {
  await connectToDatabase();

  const query: any = { 'location.country': 'BR' };
  if (filter.region && REGION_TO_STATES[filter.region]) {
    query['location.state'] = { $in: REGION_TO_STATES[filter.region] };
  }

  const creators = await UserModel.find(query)
    .select('location birthDate gender')
    .lean();

  const byState: Record<string, RegionResult> = {};

  for (const c of creators) {
    const state = (c as any)?.location?.state;
    const city = (c as any)?.location?.city;
    if (!state) continue;

    if (!byState[state]) {
      byState[state] = { state, count: 0, cities: {} };
    }
    const bucket = byState[state];
    bucket.count += 1;

    const cityKey = city || 'N/A';
    if (!bucket.cities[cityKey]) {
      bucket.cities[cityKey] = { count: 0, genders: {}, ages: [] };
    }
    const cityInfo = bucket.cities[cityKey];
    cityInfo.count += 1;

    const gender = (c as any)?.gender;
    if (gender) {
      cityInfo.genders[gender] = (cityInfo.genders[gender] || 0) + 1;
    }

    const age = calcAge((c as any)?.birthDate);
    if (age != null) cityInfo.ages.push(age);
  }

  return Object.values(byState);
}
