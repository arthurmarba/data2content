import axios, { AxiosError } from 'axios';
import { logger } from '@/app/lib/logger';

const BREAKDOWNS = ['age', 'gender', 'country', 'city'] as const;
const API_VERSION = 'v23.0';

interface DemographicResponse {
  data?: any[];
  error?: { code: number; message: string; type?: string; error_subcode?: number };
}

// A forma final dos dados, agora muito mais limpa
export interface FollowerDemographicsResult {
  follower_demographics: Record<string, Record<string, number>>;
  // Demografia de QUEM ENGAJA (não só quem segue). Pode vir vazio se a conta não
  // atinge o mínimo de engajados que a Meta exige para liberar a métrica.
  engaged_audience_demographics: Record<string, Record<string, number>>;
  retrieved_at: string;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Transforma a resposta bruta e aninhada da API em um objeto de chave-valor simples.
 * @param rawData O array 'data' bruto da resposta da API do Instagram.
 * @returns Um objeto simplificado, ex: { "18-24": 500, "25-34": 800 }.
 */
function transformApiResponse(rawData: any[]): Record<string, number> {
  const transformed: Record<string, number> = {};

  try {
    // Verifica se os dados brutos têm a estrutura esperada
    if (!rawData || !rawData[0] || !rawData[0].total_value) {
      return transformed;
    }

    const breakdowns = rawData[0].total_value.breakdowns;
    if (!breakdowns || !breakdowns[0] || !breakdowns[0].results) {
      return transformed;
    }

    const results = breakdowns[0].results;

    for (const item of results) {
      if (item.dimension_values && item.dimension_values.length > 0 && typeof item.value === 'number') {
        const key = item.dimension_values[0];
        transformed[key] = item.value;
      }
    }
  } catch (e) {
    logger.error('[transformApiResponse] Falha ao analisar os dados demográficos brutos', e);
  }

  return transformed;
}

/** Busca uma métrica demográfica (follower_demographics ou engaged_audience_demographics)
 *  quebrada por age/gender/country/city. Degrada graciosamente para {} por breakdown. */
async function fetchDemographicMetric(
  baseUrl: string,
  accessToken: string,
  metric: 'follower_demographics' | 'engaged_audience_demographics',
): Promise<Record<string, Record<string, number>>> {
  const TAG = `[fetchDemographicMetric:${metric}]`;
  const results: Record<string, Record<string, number>> = {};

  for (const breakdown of BREAKDOWNS) {
    let attempts = 0;
    const maxAttempts = 3;
    // engaged_audience_demographics exige `timeframe` (não é lifetime como a de seguidores).
    const params: Record<string, string> = {
      metric,
      period: 'lifetime',
      metric_type: 'total_value',
      breakdown,
      access_token: accessToken,
      ...(metric === 'engaged_audience_demographics' ? { timeframe: 'this_month' } : {}),
    };

    while (attempts < maxAttempts) {
      try {
        const start = Date.now();
        const response = await axios.get<DemographicResponse>(baseUrl, { params });
        logger.info(`${TAG} ${breakdown} retornado em ${Date.now() - start}ms`);
        results[breakdown] = Array.isArray(response.data?.data)
          ? transformApiResponse(response.data.data)
          : {};
        break;
      } catch (err) {
        const error = err as AxiosError;
        const status = error.response?.status;
        const data: any = error.response?.data;
        const message = data?.error?.message || error.message;
        logger.warn(`${TAG} Erro para ${breakdown} (tentativa ${attempts + 1}): ${message}`);

        if (status === 429) {
          await sleep(500 * Math.pow(2, attempts));
        } else if (data?.error?.type === 'OAuthException') {
          logger.error(`${TAG} OAuthException para ${breakdown}: ${message}`);
          results[breakdown] = {};
          break;
        } else if (status && status >= 500) {
          if (attempts >= maxAttempts - 1) {
            throw new Error(`API error ${status} for ${breakdown}: ${message}`);
          }
          await sleep(500 * Math.pow(2, attempts));
        } else {
          // 400 etc. — métrica indisponível para a conta (ex.: engaged abaixo do mínimo). Vazio.
          results[breakdown] = {};
          break;
        }
      }
      attempts++;
    }
  }

  return results;
}

export async function fetchFollowerDemographics(
  igUserId: string,
  accessToken: string
): Promise<FollowerDemographicsResult> {
  const baseUrl = `https://graph.facebook.com/${API_VERSION}/${igUserId}/insights`;

  // Quem SEGUE e quem ENGAJA — duas métricas no mesmo endpoint. A engajada pode vir
  // vazia (mínimo de engajados da Meta) e isso é tratado graciosamente.
  const follower = await fetchDemographicMetric(baseUrl, accessToken, 'follower_demographics');
  const engaged = await fetchDemographicMetric(baseUrl, accessToken, 'engaged_audience_demographics');

  return {
    follower_demographics: follower,
    engaged_audience_demographics: engaged,
    retrieved_at: new Date().toISOString(),
  };
}
