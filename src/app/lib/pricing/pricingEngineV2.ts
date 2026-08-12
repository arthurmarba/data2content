import type { CalculatorParams, FormatQuantities } from '@/app/lib/pricing/publiCalculator';
import { PRICING_V2_CONFIG, PRICING_V2_VERSION } from '@/app/lib/pricing/pricingV2.config';

type FormatKey = keyof FormatQuantities;

export type PricingEngineV2Input = {
  params: CalculatorParams;
  reach: number;
  reachByFormat?: Partial<Record<FormatKey, number>>;
  engagementPercent: number;
  cpm: number;
  calibrationFactor?: number;
  personalReferenceValue?: number | null;
  personalReferenceEligible?: boolean;
};

export type PricingEngineV2Output = {
  version: typeof PRICING_V2_VERSION;
  components: {
    production: number;
    distribution: number;
    usageRights: number;
    exclusivity: number;
    logistics: number;
  };
  protectedFloor: number;
  modelIdeal: number;
  recommendedNow: number;
  potentialIdeal: number;
  contentUnits: number;
  coverageUnits: number;
  contentSubtotal: number;
  eventPresenceSubtotal: number;
  coverageSubtotal: number;
  history: {
    eligible: boolean;
    applied: boolean;
    direction: 'below' | 'above' | 'aligned' | 'none';
    referenceValue: number | null;
    canonicalModelIdeal: number;
    campaignEquivalent: number | null;
    transitionProgress: number;
  };
};

const roundCurrency = (value: number): number => Math.round(value * 100) / 100;
const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const sumQuantities = (quantities: FormatQuantities): number =>
  quantities.reels + quantities.post + quantities.stories;

function usageRate(params: CalculatorParams): number {
  if (params.usageRights === 'organico') return 0;
  const duration = params.paidMediaDuration ?? '30d';
  const paidRate = PRICING_V2_CONFIG.paidMediaRates[duration];
  return paidRate + (params.usageRights === 'global' ? PRICING_V2_CONFIG.globalUsageExtraRate : 0);
}

function productionForQuantities(params: CalculatorParams, quantities: FormatQuantities, factor = 1): number {
  const floors = PRICING_V2_CONFIG.productionFloors[params.contentModel];
  return (
    quantities.reels * floors.reels +
    quantities.post * floors.post +
    quantities.stories * floors.stories
  ) * PRICING_V2_CONFIG.complexity[params.complexity] * factor;
}

function weightedUnits(quantities: FormatQuantities): number {
  return (
    quantities.reels * PRICING_V2_CONFIG.formatDistributionWeights.reels +
    quantities.post * PRICING_V2_CONFIG.formatDistributionWeights.post +
    quantities.stories * PRICING_V2_CONFIG.formatDistributionWeights.stories
  );
}

function distributionForQuantities(
  input: PricingEngineV2Input,
  quantities: FormatQuantities,
  factor = 1
): number {
  if (input.params.contentModel === 'ugc_whitelabel') return 0;

  const reachFor = (format: FormatKey) => Math.max(0, input.reachByFormat?.[format] ?? input.reach);
  const base =
    quantities.reels * (reachFor('reels') / 1000) * input.cpm * PRICING_V2_CONFIG.formatDistributionWeights.reels +
    quantities.post * (reachFor('post') / 1000) * input.cpm * PRICING_V2_CONFIG.formatDistributionWeights.post +
    quantities.stories * (reachFor('stories') / 1000) * input.cpm * PRICING_V2_CONFIG.formatDistributionWeights.stories;
  const engagementFactor = 1 + clamp(input.engagementPercent, 0, 25) / 100;
  const marketFactor =
    PRICING_V2_CONFIG.brandSize[input.params.brandSize] *
    PRICING_V2_CONFIG.imageRisk[input.params.imageRisk] *
    PRICING_V2_CONFIG.authority[input.params.authority] *
    PRICING_V2_CONFIG.seasonality[input.params.seasonality] *
    engagementFactor;
  const calibration = clamp(
    input.calibrationFactor ?? 1,
    PRICING_V2_CONFIG.calibrationFactorMin,
    PRICING_V2_CONFIG.calibrationFactorMax
  );
  return base * marketFactor * calibration * factor;
}

function calculateCore(input: PricingEngineV2Input) {
  const { params } = input;
  const contentQuantities = params.formatQuantities;
  const coverageQuantities = params.eventCoverageQuantities;
  const isEvent = params.deliveryType === 'evento';

  if (!isEvent && sumQuantities(contentQuantities) === 0) {
    const error = new Error('Selecione pelo menos uma entrega de conteúdo para calcular.');
    (error as Error & { status?: number }).status = 400;
    throw error;
  }

  const contentProduction = isEvent ? 0 : productionForQuantities(params, contentQuantities);
  const contentDistribution = isEvent ? 0 : distributionForQuantities(input, contentQuantities);
  const eventPresence = isEvent
    ? PRICING_V2_CONFIG.eventPresenceFloors[params.eventDetails.durationHours] *
      PRICING_V2_CONFIG.complexity[params.complexity] *
      PRICING_V2_CONFIG.brandSize[params.brandSize] *
      PRICING_V2_CONFIG.imageRisk[params.imageRisk] *
      PRICING_V2_CONFIG.authority[params.authority] *
      PRICING_V2_CONFIG.seasonality[params.seasonality]
    : 0;
  const coverageProduction = isEvent
    ? productionForQuantities(params, coverageQuantities, PRICING_V2_CONFIG.coverageFactor)
    : 0;
  const coverageDistribution = isEvent
    ? distributionForQuantities(input, coverageQuantities, PRICING_V2_CONFIG.coverageFactor)
    : 0;

  const production = contentProduction + eventPresence + coverageProduction;
  const distribution = contentDistribution + coverageDistribution;
  const commercialBase = production + distribution;
  const usageRights = commercialBase * usageRate(params) +
    (params.repostTikTok ? commercialBase * PRICING_V2_CONFIG.repostTikTokRate : 0);
  const exclusivity = commercialBase * PRICING_V2_CONFIG.exclusivityRates[params.exclusivity];
  const logistics = isEvent
    ? PRICING_V2_CONFIG.travelCosts[params.eventDetails.travelTier] +
      params.eventDetails.hotelNights * PRICING_V2_CONFIG.hotelCostPerNight
    : 0;

  const productionRights = production * usageRate(params) +
    (params.repostTikTok ? production * PRICING_V2_CONFIG.repostTikTokRate : 0);
  const productionExclusivity = production * PRICING_V2_CONFIG.exclusivityRates[params.exclusivity];

  return {
    production,
    distribution,
    commercialBase,
    usageRights,
    exclusivity,
    logistics,
    protectedFloor: production + productionRights + productionExclusivity + logistics,
    modelIdeal: commercialBase + usageRights + exclusivity + logistics,
    contentUnits: weightedUnits(contentQuantities),
    coverageUnits: weightedUnits(coverageQuantities),
    contentSubtotal: contentProduction + contentDistribution,
    eventPresenceSubtotal: eventPresence,
    coverageSubtotal: coverageProduction + coverageDistribution,
  };
}

export function calculatePricingV2(input: PricingEngineV2Input): PricingEngineV2Output {
  const core = calculateCore(input);
  const canonicalParams: CalculatorParams = {
    ...input.params,
    format: 'reels',
    deliveryType: 'conteudo',
    formatQuantities: { reels: 1, post: 0, stories: 0 },
    eventCoverageQuantities: { reels: 0, post: 0, stories: 0 },
    exclusivity: 'nenhuma',
    usageRights: 'organico',
    paidMediaDuration: null,
    repostTikTok: false,
    instagramCollab: false,
    brandSize: 'media',
    imageRisk: 'medio',
    strategicGain: 'baixo',
    contentModel: 'publicidade_perfil',
    complexity: 'simples',
    seasonality: 'normal',
  };
  const canonical = calculateCore({ ...input, params: canonicalParams, personalReferenceEligible: false });
  const reference = input.personalReferenceEligible && Number(input.personalReferenceValue) > 0
    ? Number(input.personalReferenceValue)
    : null;

  let recommendedNow = core.modelIdeal;
  let potentialIdeal = core.modelIdeal;
  let direction: PricingEngineV2Output['history']['direction'] = 'none';
  let campaignEquivalent: number | null = null;

  if (reference && canonical.commercialBase > 0 && core.commercialBase > 0) {
    campaignEquivalent = (reference / canonical.commercialBase) * core.commercialBase;
    const differenceRatio = campaignEquivalent / core.commercialBase;
    if (differenceRatio < 0.95) {
      direction = 'below';
      const bridgedCommercialBase = campaignEquivalent +
        (core.commercialBase - campaignEquivalent) * PRICING_V2_CONFIG.historyBridgeProgress;
      recommendedNow = Math.max(
        core.protectedFloor,
        bridgedCommercialBase + core.usageRights + core.exclusivity + core.logistics
      );
    } else if (differenceRatio > 1.05) {
      direction = 'above';
      potentialIdeal = Math.min(
        campaignEquivalent + core.usageRights + core.exclusivity + core.logistics,
        core.modelIdeal * PRICING_V2_CONFIG.historyUpsideCap
      );
      recommendedNow = Math.max(core.modelIdeal, potentialIdeal);
    } else {
      direction = 'aligned';
    }
  }

  potentialIdeal = Math.max(core.modelIdeal, potentialIdeal, recommendedNow);
  recommendedNow = clamp(recommendedNow, core.protectedFloor, potentialIdeal);

  return {
    version: PRICING_V2_VERSION,
    components: {
      production: roundCurrency(core.production),
      distribution: roundCurrency(core.distribution),
      usageRights: roundCurrency(core.usageRights),
      exclusivity: roundCurrency(core.exclusivity),
      logistics: roundCurrency(core.logistics),
    },
    protectedFloor: roundCurrency(core.protectedFloor),
    modelIdeal: roundCurrency(core.modelIdeal),
    recommendedNow: roundCurrency(recommendedNow),
    potentialIdeal: roundCurrency(potentialIdeal),
    contentUnits: roundCurrency(core.contentUnits),
    coverageUnits: roundCurrency(core.coverageUnits),
    contentSubtotal: roundCurrency(core.contentSubtotal),
    eventPresenceSubtotal: roundCurrency(core.eventPresenceSubtotal),
    coverageSubtotal: roundCurrency(core.coverageSubtotal),
    history: {
      eligible: Boolean(input.personalReferenceEligible),
      applied: Boolean(reference && campaignEquivalent),
      direction,
      referenceValue: reference,
      canonicalModelIdeal: roundCurrency(canonical.modelIdeal),
      campaignEquivalent: campaignEquivalent === null ? null : roundCurrency(campaignEquivalent),
      transitionProgress: direction === 'below' ? PRICING_V2_CONFIG.historyBridgeProgress : 0,
    },
  };
}
