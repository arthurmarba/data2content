import axios, { AxiosError } from 'axios';
import { logger } from '@/app/lib/logger';

const BREAKDOWNS = ['age', 'gender', 'country', 'city'] as const;
const API_VERSION = 'v23.0';

interface DemographicResponse {
  data?: any[];
  error?: { code: number; message: string; type?: string; error_subcode?: number };
}

export interface FollowerDemographicsResult {
  follower_demographics: Record<string, any[]>;
  retrieved_at: string;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function fetchFollowerDemographics(
  igUserId: string,
  accessToken: string
): Promise<FollowerDemographicsResult> {
  const TAG = '[fetchFollowerDemographics]';
  const baseUrl = `https://graph.facebook.com/${API_VERSION}/${igUserId}/insights`;

  const results: Record<string, any[]> = {};

  for (const breakdown of BREAKDOWNS) {
    let attempts = 0;
    const maxAttempts = 3;
    const params = {
      metric: 'follower_demographics',
      period: 'lifetime',
      metric_type: 'total_value',
      breakdown,
      access_token: accessToken,
    };

    while (attempts < maxAttempts) {
      try {
        const start = Date.now();
        const response = await axios.get<DemographicResponse>(baseUrl, { params });
        const duration = Date.now() - start;
        logger.info(`${TAG} ${breakdown} retornado em ${duration}ms`);
        if (Array.isArray(response.data?.data)) {
          results[breakdown] = response.data.data;
        } else {
          results[breakdown] = [];
        }
        break;
      } catch (err) {
        const error = err as AxiosError;
        const status = error.response?.status;
        const data: any = error.response?.data;
        const message = data?.error?.message || error.message;
        logger.warn(`${TAG} Erro para ${breakdown} (tentativa ${attempts + 1}): ${message}`);

        if (status === 429) {
          const backoff = 500 * Math.pow(2, attempts);
          await sleep(backoff);
        } else if (data?.error?.type === 'OAuthException') {
          logger.error(`${TAG} OAuthException para ${breakdown}: ${message}`);
          results[breakdown] = [];
          break;
        } else if (status && status >= 500) {
          if (attempts >= maxAttempts - 1) {
            throw new Error(`API error ${status} for ${breakdown}: ${message}`);
          }
          const backoff = 500 * Math.pow(2, attempts);
          await sleep(backoff);
        } else {
          results[breakdown] = [];
          break;
        }
      }
      attempts++;
    }
  }

  return { follower_demographics: results, retrieved_at: new Date().toISOString() };
}

