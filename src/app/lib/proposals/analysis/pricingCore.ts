import {
  runPubliCalculator,
  VALID_AUTHORITIES,
  VALID_BRAND_SIZES,
  VALID_COMPLEXITIES,
  VALID_CONTENT_MODELS,
  VALID_EVENT_DURATION_HOURS,
  VALID_EXCLUSIVITIES,
  VALID_IMAGE_RISKS,
  VALID_PAID_MEDIA_DURATIONS,
  VALID_SEASONALITIES,
  VALID_STRATEGIC_GAINS,
  VALID_TRAVEL_TIERS,
  VALID_USAGE_RIGHTS,
  type CalculatorParamsInput,
} from '@/app/lib/pricing/publiCalculator';
import { logger } from '@/app/lib/logger';
import { normalizeCurrencyCode } from '@/utils/currency';

import type { ProposalPricingCoreContext } from './types';

type ProposalPricingCoreInput = {
  user: any | null;
  proposal: {
    currency: string;
    deliverables: string[];
  };
  latestCalculation: any | null;
  pricingCoreEnabled: boolean;
  brandRiskEnabled: boolean;
  calibrationEnabled: boolean;
};

type ConservativeMappingResult = {
  params: CalculatorParamsInput;
  resolvedDefaults: string[];
};

const DELIVERY_EVENT_KEYWORDS = [
  'evento',
  'presença',
  'presenca',
  'palestra',
  'aparição',
  'aparicao',
  'host',
  'cobertura',
];

const REELS_TOKENS = ['reels?', 'vídeos?', 'videos?'];
const POST_TOKENS = ['posts?', 'carrossel(?:es)?', 'feed'];
const STORIES_TOKENS = ['stories?', 'story'];

const DEFAULT_FORMAT_QUANTITIES = { reels: 1, post: 0, stories: 0 };
const ZERO_FORMAT_QUANTITIES = { reels: 0, post: 0, stories: 0 };

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function toPositiveInt(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.trunc(value));
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.max(0, Math.trunc(parsed));
  }
  return 0;
}

function normalizeDeliverables(deliverables: string[]): string[] {
  return deliverables
    .map((item) => item.toLowerCase().trim())
    .filter((item) => item.length > 0);
}

function extractCountByTokens(line: string, tokenPatterns: string[]): number {
  const normalized = line.toLowerCase();
  let total = 0;
  for (const token of tokenPatterns) {
    const regex = new RegExp(`(\\d+)\\s*${token}`, 'gi');
    let match = regex.exec(normalized);
    while (match) {
      const value = Number.parseInt(match[1] || '0', 10);
      if (Number.isFinite(value) && value > 0) total += value;
      match = regex.exec(normalized);
    }
  }
  if (total > 0) return total;

  const hasKeyword = tokenPatterns.some((token) => new RegExp(`\\b${token}\\b`, 'i').test(normalized));
  return hasKeyword ? 1 : 0;
}

function inferDeliveryType(input: { deliverables: string[]; latestDeliveryType?: string | null }): 'conteudo' | 'evento' {
  const normalized = input.deliverables.join(' ').toLowerCase();
  if (DELIVERY_EVENT_KEYWORDS.some((token) => normalized.includes(token))) return 'evento';
  if (input.latestDeliveryType === 'evento') return 'evento';
  return 'conteudo';
}

function inferFormatQuantities(deliverables: string[]) {
  const normalized = normalizeDeliverables(deliverables);
  if (!normalized.length) return { ...ZERO_FORMAT_QUANTITIES };

  return normalized.reduce(
    (acc, line) => {
      acc.reels += extractCountByTokens(line, REELS_TOKENS);
      acc.post += extractCountByTokens(line, POST_TOKENS);
      acc.stories += extractCountByTokens(line, STORIES_TOKENS);
      return acc;
    },
    { reels: 0, post: 0, stories: 0 }
  );
}

function hasAnyQuantity(quantities: { reels: number; post: number; stories: number }): boolean {
  return quantities.reels > 0 || quantities.post > 0 || quantities.stories > 0;
}

function pickSetValue<T extends string>(
  raw: unknown,
  allowed: Set<string>
): T | null {
  if (typeof raw !== 'string') return null;
  return allowed.has(raw) ? (raw as T) : null;
}

function resolveLatestQuantities(raw: any): { reels: number; post: number; stories: number } {
  return {
    reels: clamp(toPositiveInt(raw?.reels), 0, 20),
    post: clamp(toPositiveInt(raw?.post), 0, 20),
    stories: clamp(toPositiveInt(raw?.stories), 0, 20),
  };
}

export function buildConservativeCalculatorParams(input: {
  deliverables: string[];
  latestCalculation: any | null;
}): ConservativeMappingResult {
  const resolvedDefaults = new Set<string>();
  const latestParams = input.latestCalculation?.params ?? {};
  const inferredDeliveryType = inferDeliveryType({
    deliverables: input.deliverables,
    latestDeliveryType: typeof latestParams?.deliveryType === 'string' ? latestParams.deliveryType : null,
  });

  const inferredQuantities = inferFormatQuantities(input.deliverables);
  let formatQuantities = inferredQuantities;
  if (!hasAnyQuantity(formatQuantities) && inferredDeliveryType === 'conteudo') {
    const latestQuantities = resolveLatestQuantities(latestParams?.formatQuantities);
    if (hasAnyQuantity(latestQuantities)) {
      formatQuantities = latestQuantities;
      resolvedDefaults.add('formatQuantities_from_latest');
    } else {
      formatQuantities = { ...DEFAULT_FORMAT_QUANTITIES };
      resolvedDefaults.add('formatQuantities_default_1_reel');
    }
  }

  let eventCoverageQuantities =
    inferredDeliveryType === 'evento'
      ? inferredQuantities
      : { ...ZERO_FORMAT_QUANTITIES };
  if (inferredDeliveryType === 'evento' && !hasAnyQuantity(eventCoverageQuantities)) {
    eventCoverageQuantities = resolveLatestQuantities(latestParams?.eventCoverageQuantities);
    if (hasAnyQuantity(eventCoverageQuantities)) {
      resolvedDefaults.add('eventCoverage_from_latest');
    }
  }

  const exclusivity = pickSetValue<CalculatorParamsInput['exclusivity']>(latestParams?.exclusivity, VALID_EXCLUSIVITIES);
  if (!exclusivity) resolvedDefaults.add('exclusivity_default_nenhuma');

  const usageRights = pickSetValue<CalculatorParamsInput['usageRights']>(latestParams?.usageRights, VALID_USAGE_RIGHTS);
  if (!usageRights) resolvedDefaults.add('usageRights_default_organico');

  const resolvedUsageRights = usageRights ?? 'organico';
  let paidMediaDuration: CalculatorParamsInput['paidMediaDuration'] = null;
  if (resolvedUsageRights !== 'organico') {
    paidMediaDuration = pickSetValue<NonNullable<CalculatorParamsInput['paidMediaDuration']>>(
      latestParams?.paidMediaDuration,
      VALID_PAID_MEDIA_DURATIONS
    );
    if (!paidMediaDuration) {
      paidMediaDuration = '30d';
      resolvedDefaults.add('paidMediaDuration_default_30d');
    }
  }

  const complexity = pickSetValue<CalculatorParamsInput['complexity']>(latestParams?.complexity, VALID_COMPLEXITIES);
  if (!complexity) resolvedDefaults.add('complexity_default_roteiro');

  const authority = pickSetValue<CalculatorParamsInput['authority']>(latestParams?.authority, VALID_AUTHORITIES);
  if (!authority) resolvedDefaults.add('authority_default_padrao');

  const seasonality = pickSetValue<NonNullable<CalculatorParamsInput['seasonality']>>(
    latestParams?.seasonality,
    VALID_SEASONALITIES
  );
  if (!seasonality) resolvedDefaults.add('seasonality_default_normal');

  const brandSize = pickSetValue<NonNullable<CalculatorParamsInput['brandSize']>>(
    latestParams?.brandSize,
    VALID_BRAND_SIZES
  );
  if (!brandSize) resolvedDefaults.add('brandSize_default_media');

  const imageRisk = pickSetValue<NonNullable<CalculatorParamsInput['imageRisk']>>(
    latestParams?.imageRisk,
    VALID_IMAGE_RISKS
  );
  if (!imageRisk) resolvedDefaults.add('imageRisk_default_medio');

  const strategicGain = pickSetValue<NonNullable<CalculatorParamsInput['strategicGain']>>(
    latestParams?.strategicGain,
    VALID_STRATEGIC_GAINS
  );
  if (!strategicGain) resolvedDefaults.add('strategicGain_default_baixo');

  const contentModel = pickSetValue<NonNullable<CalculatorParamsInput['contentModel']>>(
    latestParams?.contentModel,
    VALID_CONTENT_MODELS
  );
  if (!contentModel) resolvedDefaults.add('contentModel_default_publicidade_perfil');

  const durationCandidate = toPositiveInt(latestParams?.eventDetails?.durationHours);
  const durationHours = VALID_EVENT_DURATION_HOURS.has(durationCandidate) ? durationCandidate : 4;
  if (!VALID_EVENT_DURATION_HOURS.has(durationCandidate)) resolvedDefaults.add('eventDuration_default_4h');

  const travelCandidate =
    typeof latestParams?.eventDetails?.travelTier === 'string' && VALID_TRAVEL_TIERS.has(latestParams.eventDetails.travelTier)
      ? latestParams.eventDetails.travelTier
      : 'local';
  if (travelCandidate === 'local' && latestParams?.eventDetails?.travelTier !== 'local') {
    resolvedDefaults.add('eventTravel_default_local');
  }

  const params: CalculatorParamsInput = {
    format: inferredDeliveryType === 'evento' ? 'evento' : 'pacote',
    deliveryType: inferredDeliveryType,
    formatQuantities: inferredDeliveryType === 'conteudo' ? formatQuantities : { ...ZERO_FORMAT_QUANTITIES },
    eventCoverageQuantities,
    eventDetails: {
      durationHours: durationHours as 2 | 4 | 8,
      travelTier: travelCandidate as 'local' | 'nacional' | 'internacional',
      hotelNights: clamp(toPositiveInt(latestParams?.eventDetails?.hotelNights), 0, 10),
    },
    exclusivity: exclusivity ?? 'nenhuma',
    usageRights: resolvedUsageRights,
    paidMediaDuration,
    repostTikTok: typeof latestParams?.repostTikTok === 'boolean' ? latestParams.repostTikTok : false,
    instagramCollab: typeof latestParams?.instagramCollab === 'boolean' ? latestParams.instagramCollab : false,
    brandSize: brandSize ?? 'media',
    imageRisk: imageRisk ?? 'medio',
    strategicGain: strategicGain ?? 'baixo',
    contentModel: contentModel ?? 'publicidade_perfil',
    allowStrategicWaiver:
      typeof latestParams?.allowStrategicWaiver === 'boolean' ? latestParams.allowStrategicWaiver : false,
    complexity: complexity ?? 'roteiro',
    authority: authority ?? 'padrao',
    seasonality: seasonality ?? 'normal',
  };

  return {
    params,
    resolvedDefaults: Array.from(resolvedDefaults),
  };
}

function buildFallbackPricingCore(input: {
  latestCalculation: any | null;
  confidence: number;
  limitations: string[];
  resolvedDefaults?: string[];
}): ProposalPricingCoreContext {
  const just = input.latestCalculation?.result?.justo;
  const strategic = input.latestCalculation?.result?.estrategico;
  const premium = input.latestCalculation?.result?.premium;

  return {
    source: 'fallback',
    calculatorJusto: typeof just === 'number' && Number.isFinite(just) ? just : null,
    calculatorEstrategico: typeof strategic === 'number' && Number.isFinite(strategic) ? strategic : null,
    calculatorPremium: typeof premium === 'number' && Number.isFinite(premium) ? premium : null,
    confidence: clamp(input.confidence, 0, 1),
    resolvedDefaults: input.resolvedDefaults ?? [],
    limitations: input.limitations,
  };
}

export async function resolveProposalPricingCore(input: ProposalPricingCoreInput): Promise<ProposalPricingCoreContext> {
  const normalizedCurrency = normalizeCurrencyCode(input.proposal.currency) ?? 'BRL';

  if (!input.pricingCoreEnabled) {
    return buildFallbackPricingCore({
      latestCalculation: input.latestCalculation,
      confidence: 0.35,
      limitations: ['Camada de precificação da calculadora está desativada para campanhas.'],
    });
  }

  if (normalizedCurrency !== 'BRL') {
    return buildFallbackPricingCore({
      latestCalculation: input.latestCalculation,
      confidence: 0.25,
      limitations: ['Moeda diferente de BRL: usamos apenas histórico local, sem conversão cambial automática.'],
    });
  }

  if (!input.user?._id) {
    return buildFallbackPricingCore({
      latestCalculation: input.latestCalculation,
      confidence: 0.3,
      limitations: ['Perfil do criador indisponível para rodar o motor completo da calculadora.'],
    });
  }

  const mapping = buildConservativeCalculatorParams({
    deliverables: input.proposal.deliverables,
    latestCalculation: input.latestCalculation,
  });

  try {
    const result = await runPubliCalculator({
      user: input.user,
      params: mapping.params,
      brandRiskEnabled: input.brandRiskEnabled,
      calibrationEnabled: input.calibrationEnabled,
      explanationPrefix: 'Campanhas AI',
    });

    const calibrationConfidence = result.calibration.enabled ? result.calibration.confidence : 0.72;
    const defaultsPenalty = Math.min(mapping.resolvedDefaults.length * 0.04, 0.32);
    const confidence = clamp(calibrationConfidence - defaultsPenalty, 0.15, 0.95);

    return {
      source: 'calculator_core_v1',
      calculatorJusto: result.result.justo,
      calculatorEstrategico: result.result.estrategico,
      calculatorPremium: result.result.premium,
      confidence,
      resolvedDefaults: mapping.resolvedDefaults,
      limitations: [],
    };
  } catch (error) {
    logger.warn('[PROPOSALS][pricingCore] fallback due to calculator failure', {
      error: error instanceof Error ? error.message : 'unknown_error',
    });

    return buildFallbackPricingCore({
      latestCalculation: input.latestCalculation,
      confidence: 0.3,
      resolvedDefaults: mapping.resolvedDefaults,
      limitations: [
        'Não foi possível calcular a base pelo motor da calculadora neste momento; usamos fallback histórico.',
      ],
    });
  }
}
