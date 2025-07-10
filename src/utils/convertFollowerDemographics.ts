import { FollowerDemographicsResult } from '@/services/instagramInsightsService';
import { IAudienceDemographics, IDemographicBreakdown } from '@/app/models/demographics/AudienceDemographicSnapshot';

/**
 * Converts the follower demographics returned by fetchFollowerDemographics
 * into the IAudienceDemographics schema format expected by Mongoose.
 */
export function convertFollowerDemographics(
  data: FollowerDemographicsResult
): IAudienceDemographics {
  const convertMap = (m?: Record<string, number>): IDemographicBreakdown[] => {
    if (!m) return [];
    return Object.entries(m)
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);
  };

  const follower = data.follower_demographics || {};

  return {
    follower_demographics: {
      age: convertMap(follower.age),
      gender: convertMap(follower.gender),
      country: convertMap(follower.country),
      city: convertMap(follower.city),
    },
  };
}
