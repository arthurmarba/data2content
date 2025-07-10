import { FollowerDemographicsResult } from '@/services/instagramInsightsService';
import { IAudienceDemographics } from '@/app/models/demographics/AudienceDemographicSnapshot';

/**
 * Converts the follower demographics returned by fetchFollowerDemographics
 * into the IAudienceDemographics schema format expected by Mongoose.
 */
export function convertFollowerDemographics(
  data: FollowerDemographicsResult
): IAudienceDemographics {
  const convertMap = (m?: Record<string, number>): Record<string, number> => {
    if (!m) return {};
    return Object.fromEntries(
      Object.entries(m).sort((a, b) => b[1] - a[1])
    );
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
