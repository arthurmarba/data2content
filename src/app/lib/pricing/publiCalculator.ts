import { subDays } from 'date-fns/subDays';

import type { IUser } from '@/app/models/User';
import { fetchAndPrepareReportData, getAdDealInsights } from '@/app/lib/dataService';
import { resolveSegmentCpm } from '@/app/lib/cpmBySegment';
import { logger } from '@/app/lib/logger';
import { resolvePricingCalibrationForUser, type CalibrationConfidenceBand, type CalibrationLinkQuality } from '@/app/lib/pricing/calibrationService';

export const VALID_FORMATS = new Set(['post', 'reels', 'stories', 'pacote', 'evento']);
export const VALID_EXCLUSIVITIES = new Set(['nenhuma', '7d', '15d', '30d', '90d', '180d', '365d']);
export const VALID_USAGE_RIGHTS = new Set(['organico', 'midiapaga', 'global']);
export const VALID_PAID_MEDIA_DURATIONS = new Set(['7d', '15d', '30d', '90d', '180d', '365d']);
export const VALID_BRAND_SIZES = new Set(['pequena', 'media', 'grande']);
export const VALID_IMAGE_RISKS = new Set(['baixo', 'medio', 'alto']);
export const VALID_STRATEGIC_GAINS = new Set(['baixo', 'medio', 'alto']);
export const VALID_CONTENT_MODELS = new Set(['publicidade_perfil', 'ugc_whitelabel']);
export const VALID_COMPLEXITIES = new Set(['simples', 'roteiro', 'profissional']);
export const VALID_AUTHORITIES = new Set(['padrao', 'ascensao', 'autoridade', 'celebridade']);
export const VALID_SEASONALITIES = new Set(['normal', 'alta', 'baixa']);
export const VALID_DELIVERY_TYPES = new Set(['conteudo', 'evento']);
export const VALID_TRAVEL_TIERS = new Set(['local', 'nacional', 'internacional']);
export const VALID_EVENT_DURATION_HOURS = new Set([2, 4, 8]);

export type CalculatorFormat = 'post' | 'reels' | 'stories' | 'pacote' | 'evento';
export type DeliveryType = 'conteudo' | 'evento';
export type FormatQuantities = {
  reels: number;
  post: number;
  stories: number;
};
export type EventDetails = {
  durationHours: 2 | 4 | 8;
  travelTier: 'local' | 'nacional' | 'internacional';
  hotelNights: number;
};
export type PaidMediaDuration = '7d' | '15d' | '30d' | '90d' | '180d' | '365d';
export type BrandSize = 'pequena' | 'media' | 'grande';
export type ImageRisk = 'baixo' | 'medio' | 'alto';
export type StrategicGain = 'baixo' | 'medio' | 'alto';
export type ContentModel = 'publicidade_perfil' | 'ugc_whitelabel';

export type CalculatorParams = {
  format: CalculatorFormat;
  deliveryType: DeliveryType;
  formatQuantities: FormatQuantities;
  eventDetails: EventDetails;
  eventCoverageQuantities: FormatQuantities;
  exclusivity: 'nenhuma' | '7d' | '15d' | '30d' | '90d' | '180d' | '365d';
  usageRights: 'organico' | 'midiapaga' | 'global';
  paidMediaDuration: PaidMediaDuration | null;
  repostTikTok: boolean;
  instagramCollab: boolean;
  brandSize: BrandSize;
  imageRisk: ImageRisk;
  strategicGain: StrategicGain;
  contentModel: ContentModel;
  allowStrategicWaiver: boolean;
  complexity: 'simples' | 'roteiro' | 'profissional';
  authority: 'padrao' | 'ascensao' | 'autoridade' | 'celebridade';
  seasonality: 'normal' | 'alta' | 'baixa';
};

export type CalculatorParamsInput = {
  format?: CalculatorFormat;
  deliveryType?: DeliveryType;
  formatQuantities?: Partial<FormatQuantities> | null;
  eventDetails?: Partial<EventDetails> | null;
  eventCoverageQuantities?: Partial<FormatQuantities> | null;
  exclusivity: CalculatorParams['exclusivity'];
  usageRights: CalculatorParams['usageRights'];
  paidMediaDuration?: CalculatorParams['paidMediaDuration'];
  repostTikTok?: boolean;
  instagramCollab?: boolean;
  brandSize?: CalculatorParams['brandSize'];
  imageRisk?: CalculatorParams['imageRisk'];
  strategicGain?: CalculatorParams['strategicGain'];
  contentModel?: CalculatorParams['contentModel'];
  allowStrategicWaiver?: boolean;
  complexity: CalculatorParams['complexity'];
  authority: CalculatorParams['authority'];
  seasonality?: CalculatorParams['seasonality'];
};

export type PubliCalculatorBreakdown = {
  contentUnits: number;
  contentJusto: number;
  eventPresenceJusto: number;
  coverageUnits: number;
  coverageJusto: number;
  travelCost: number;
  hotelCost: number;
  logisticsSuggested: number;
  logisticsIncludedInCache: false;
};

export type PubliCalculatorResult = {
  metrics: {
    reach: number;
    engagement: number;
    profileSegment: string;
  };
  params: CalculatorParams;
  result: {
    estrategico: number;
    justo: number;
    premium: number;
  };
  breakdown: PubliCalculatorBreakdown;
  cpmApplied: number;
  cpmSource: 'seed' | 'dynamic';
  calibration: {
    enabled: boolean;
    baseJusto: number;
    factorRaw: number;
    factorApplied: number;
    guardrailApplied: boolean;
    confidence: number;
    confidenceBand: CalibrationConfidenceBand;
    segmentSampleSize: number;
    creatorSampleSize: number;
    windowDaysSegment: number;
    windowDaysCreator: number;
    lowConfidenceRangeExpanded: boolean;
    linkQuality: CalibrationLinkQuality;
  };
  avgTicket: number | null;
  totalDeals: number;
  explanation: string;
};

const roundCurrency = (value: number): number => Math.round(value * 100) / 100;

const DEFAULT_FORMAT_QUANTITIES: FormatQuantities = {
  reels: 1,
  post: 0,
  stories: 0,
};

const ZERO_FORMAT_QUANTITIES: FormatQuantities = {
  reels: 0,
  post: 0,
  stories: 0,
};

const DEFAULT_EVENT_DETAILS: EventDetails = {
  durationHours: 4,
  travelTier: 'local',
  hotelNights: 0,
};

const FORMAT_MULTIPLIERS = {
  post: 1.0,
  reels: 1.4,
  stories: 0.8,
  pacote: 1.6,
  evento: 1.0,
} as const;

const EVENT_DURATION_MULTIPLIERS: Record<EventDetails['durationHours'], number> = {
  2: 1.8,
  4: 2.4,
  8: 3.2,
};

const TRAVEL_COSTS: Record<EventDetails['travelTier'], number> = {
  local: 0,
  nacional: 1200,
  internacional: 4500,
};

const HOTEL_COST_PER_NIGHT = 450;
const COVERAGE_FACTOR = 0.9;
const MIN_ENGAGEMENT_PERCENT = 0;
const MAX_ENGAGEMENT_PERCENT = 25;

const multiplicadores = {
  formato: FORMAT_MULTIPLIERS,
  exclusividade: {
    nenhuma: 1.0,
    '7d': 1.1,
    '15d': 1.2,
    '30d': 1.3,
    '90d': 1.45,
    '180d': 1.6,
    '365d': 1.8,
  },
  usoImagem: {
    organico: 1.0,
    midiapaga: 1.0,
    global: 1.17,
  },
  duracaoMidiaPaga: {
    nenhum: 1.0,
    '7d': 1.05,
    '15d': 1.1,
    '30d': 1.2,
    '90d': 1.3,
    '180d': 1.45,
    '365d': 1.6,
  },
  repostTikTok: {
    nao: 1.0,
    sim: 1.1,
  },
  brandSize: {
    pequena: 1.1,
    media: 1.0,
    grande: 0.95,
  },
  imageRisk: {
    baixo: 0.9,
    medio: 1.15,
    alto: 1.4,
  },
  strategicGain: {
    baixo: 1.0,
    medio: 0.9,
    alto: 0.75,
  },
  contentModel: {
    publicidade_perfil: 1.0,
    ugc_whitelabel: 0.65,
  },
  complexidade: {
    simples: 1.0,
    roteiro: 1.1,
    profissional: 1.3,
  },
  autoridade: {
    padrao: 1.0,
    ascensao: 1.2,
    autoridade: 1.5,
    celebridade: 2.0,
  },
  sazonalidade: {
    normal: 1.0,
    alta: 1.2,
    baixa: 0.9,
  },
  eventoDuracao: EVENT_DURATION_MULTIPLIERS,
  deslocamento: TRAVEL_COSTS,
} as const;

export const PRICING_MULTIPLIERS = multiplicadores;

const QUANTITY_MAX = 20;
const DEFAULT_PAID_MEDIA_DURATION: PaidMediaDuration = '30d';
const DEFAULT_BRAND_SIZE: BrandSize = 'media';
const DEFAULT_IMAGE_RISK: ImageRisk = 'medio';
const DEFAULT_STRATEGIC_GAIN: StrategicGain = 'baixo';
const DEFAULT_CONTENT_MODEL: ContentModel = 'publicidade_perfil';
const BRAND_RISK_MIN_BY_IMAGE_RISK: Record<ImageRisk, number | null> = {
  baixo: null,
  medio: 1.0,
  alto: 1.2,
};
const CALIBRATION_FACTOR_MIN = 0.75;
const CALIBRATION_FACTOR_MAX = 1.25;

type NormalizedCalculatorParams = CalculatorParams & {
  legacyPackageMode: boolean;
};

const toInteger = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.trunc(parsed);
  }
  return 0;
};

const clampQuantity = (value: unknown): number => {
  const intValue = toInteger(value);
  if (intValue < 0) return 0;
  if (intValue > QUANTITY_MAX) return QUANTITY_MAX;
  return intValue;
};

const sanitizeFormatQuantities = (
  raw: Partial<FormatQuantities> | null | undefined,
  fallback: FormatQuantities
): FormatQuantities => ({
  reels: clampQuantity(raw?.reels ?? fallback.reels),
  post: clampQuantity(raw?.post ?? fallback.post),
  stories: clampQuantity(raw?.stories ?? fallback.stories),
});

const hasAnyQuantity = (quantities: FormatQuantities): boolean =>
  quantities.reels > 0 || quantities.post > 0 || quantities.stories > 0;

const mapLegacyFormatToQuantities = (format?: CalculatorFormat): FormatQuantities => {
  switch (format) {
    case 'reels':
      return { reels: 1, post: 0, stories: 0 };
    case 'post':
      return { reels: 0, post: 1, stories: 0 };
    case 'stories':
      return { reels: 0, post: 0, stories: 1 };
    default:
      return { ...DEFAULT_FORMAT_QUANTITIES };
  }
};

const deriveLegacyFormat = (params: {
  deliveryType: DeliveryType;
  formatQuantities: FormatQuantities;
  legacyPackageMode?: boolean;
}): CalculatorFormat => {
  if (params.deliveryType === 'evento') return 'evento';
  if (params.legacyPackageMode) return 'pacote';

  const entries = Object.entries(params.formatQuantities).filter(([, qty]) => qty > 0) as Array<[
    keyof FormatQuantities,
    number,
  ]>;

  const singleEntry = entries[0];
  if (entries.length === 1 && singleEntry && singleEntry[1] === 1) {
    const [format] = singleEntry;
    return format;
  }

  return 'pacote';
};

const sanitizeEventDetails = (raw: Partial<EventDetails> | null | undefined): EventDetails => {
  const durationCandidate = toInteger(raw?.durationHours);
  const durationHours: EventDetails['durationHours'] = VALID_EVENT_DURATION_HOURS.has(durationCandidate)
    ? (durationCandidate as EventDetails['durationHours'])
    : DEFAULT_EVENT_DETAILS.durationHours;

  const travelCandidate = raw?.travelTier;
  const travelTier: EventDetails['travelTier'] =
    typeof travelCandidate === 'string' && VALID_TRAVEL_TIERS.has(travelCandidate)
      ? (travelCandidate as EventDetails['travelTier'])
      : DEFAULT_EVENT_DETAILS.travelTier;

  return {
    durationHours,
    travelTier,
    hotelNights: clampQuantity(raw?.hotelNights ?? DEFAULT_EVENT_DETAILS.hotelNights),
  };
};

const sanitizePaidMediaDuration = (
  rawDuration: unknown,
  usageRights: CalculatorParams['usageRights']
): CalculatorParams['paidMediaDuration'] => {
  if (usageRights === 'organico') return null;
  if (typeof rawDuration === 'string' && VALID_PAID_MEDIA_DURATIONS.has(rawDuration)) {
    return rawDuration as PaidMediaDuration;
  }
  return DEFAULT_PAID_MEDIA_DURATION;
};

const computeWeightedUnits = (quantities: FormatQuantities): number =>
  quantities.reels * FORMAT_MULTIPLIERS.reels +
  quantities.post * FORMAT_MULTIPLIERS.post +
  quantities.stories * FORMAT_MULTIPLIERS.stories;

export function normalizeCalculatorParams(input: CalculatorParamsInput): NormalizedCalculatorParams {
  const inferredDeliveryType: DeliveryType =
    input.deliveryType && VALID_DELIVERY_TYPES.has(input.deliveryType)
      ? input.deliveryType
      : input.format === 'evento'
        ? 'evento'
        : 'conteudo';

  const legacyPackageMode =
    inferredDeliveryType === 'conteudo' &&
    input.format === 'pacote' &&
    (!input.formatQuantities || !hasAnyQuantity(sanitizeFormatQuantities(input.formatQuantities, ZERO_FORMAT_QUANTITIES)));

  const baseFormatQuantities = input.formatQuantities
    ? sanitizeFormatQuantities(input.formatQuantities, ZERO_FORMAT_QUANTITIES)
    : inferredDeliveryType === 'evento'
      ? { ...ZERO_FORMAT_QUANTITIES }
      : mapLegacyFormatToQuantities(input.format);

  const formatQuantities = hasAnyQuantity(baseFormatQuantities)
    ? baseFormatQuantities
    : { ...ZERO_FORMAT_QUANTITIES };

  const eventCoverageQuantities =
    inferredDeliveryType === 'evento'
      ? sanitizeFormatQuantities(input.eventCoverageQuantities, ZERO_FORMAT_QUANTITIES)
      : { ...ZERO_FORMAT_QUANTITIES };

  const eventDetails = sanitizeEventDetails(input.eventDetails);
  const usageRights: CalculatorParams['usageRights'] =
    typeof input.usageRights === 'string' && VALID_USAGE_RIGHTS.has(input.usageRights)
      ? input.usageRights
      : 'organico';
  const exclusivity: CalculatorParams['exclusivity'] =
    typeof input.exclusivity === 'string' && VALID_EXCLUSIVITIES.has(input.exclusivity)
      ? input.exclusivity
      : 'nenhuma';
  const paidMediaDuration = sanitizePaidMediaDuration(input.paidMediaDuration, usageRights);
  const brandSize: CalculatorParams['brandSize'] =
    typeof input.brandSize === 'string' && VALID_BRAND_SIZES.has(input.brandSize)
      ? input.brandSize
      : DEFAULT_BRAND_SIZE;
  const imageRisk: CalculatorParams['imageRisk'] =
    typeof input.imageRisk === 'string' && VALID_IMAGE_RISKS.has(input.imageRisk)
      ? input.imageRisk
      : DEFAULT_IMAGE_RISK;
  const strategicGain: CalculatorParams['strategicGain'] =
    typeof input.strategicGain === 'string' && VALID_STRATEGIC_GAINS.has(input.strategicGain)
      ? input.strategicGain
      : DEFAULT_STRATEGIC_GAIN;
  const contentModel: CalculatorParams['contentModel'] =
    typeof input.contentModel === 'string' && VALID_CONTENT_MODELS.has(input.contentModel)
      ? input.contentModel
      : DEFAULT_CONTENT_MODEL;
  const complexity: CalculatorParams['complexity'] =
    typeof input.complexity === 'string' && VALID_COMPLEXITIES.has(input.complexity)
      ? input.complexity
      : 'simples';
  const authority: CalculatorParams['authority'] =
    typeof input.authority === 'string' && VALID_AUTHORITIES.has(input.authority)
      ? input.authority
      : 'padrao';
  const seasonality: CalculatorParams['seasonality'] =
    typeof input.seasonality === 'string' && VALID_SEASONALITIES.has(input.seasonality)
      ? input.seasonality
      : 'normal';

  const baseParams: Omit<CalculatorParams, 'format'> = {
    deliveryType: inferredDeliveryType,
    formatQuantities,
    eventDetails,
    eventCoverageQuantities,
    exclusivity,
    usageRights,
    paidMediaDuration,
    repostTikTok: Boolean(input.repostTikTok),
    instagramCollab: Boolean(input.instagramCollab),
    brandSize,
    imageRisk,
    strategicGain,
    contentModel,
    allowStrategicWaiver: Boolean(input.allowStrategicWaiver),
    complexity,
    authority,
    seasonality,
  };

  return {
    ...baseParams,
    format: deriveLegacyFormat({
      deliveryType: baseParams.deliveryType,
      formatQuantities: baseParams.formatQuantities,
      legacyPackageMode,
    }),
    legacyPackageMode,
  };
}

type PubliCalculatorInput = {
  user: IUser;
  params: CalculatorParamsInput;
  periodDays?: number;
  explanationPrefix?: string;
  brandRiskEnabled?: boolean;
  calibrationEnabled?: boolean;
};

export async function runPubliCalculator(input: PubliCalculatorInput): Promise<PubliCalculatorResult> {
  const params = normalizeCalculatorParams(input.params);
  const brandRiskEnabled = input.brandRiskEnabled ?? true;
  const calibrationEnabled = input.calibrationEnabled ?? false;

  const periodDays =
    Number.isFinite(input.periodDays) && (input.periodDays as number) > 0
      ? Math.min(input.periodDays as number, 365)
      : 90;
  const sinceDate = subDays(new Date(), periodDays);
  const userId = String((input.user as any)?._id || (input.user as any)?.id || 'unknown');

  const [{ enrichedReport }, adDealInsights] = await Promise.all([
    fetchAndPrepareReportData({ user: input.user, analysisSinceDate: sinceDate }),
    getAdDealInsights(userId, periodDays <= 30 ? 'last30d' : periodDays <= 90 ? 'last90d' : 'all').catch((err) => {
      logger.error('[publiCalculator] Falha ao buscar insights de AdDeals', err);
      return null;
    }),
  ]);

  const profileSegment = enrichedReport.profileSegment || 'default';
  const overallStats = (enrichedReport.overallStats ?? {}) as Record<string, unknown>;
  const reachAvgRaw = typeof overallStats.avgReach === 'number' ? overallStats.avgReach : 0;
  const engagementRateRaw =
    typeof overallStats.avgEngagementRate === 'number'
      ? overallStats.avgEngagementRate
      : typeof overallStats.avgEngagement === 'number'
        ? overallStats.avgEngagement
        : 0;

  if (!Number.isFinite(reachAvgRaw) || reachAvgRaw <= 0) {
    const err = new Error('Metricas insuficientes para calcular o valor sugerido. Registre novos conteudos e tente novamente.');
    (err as any).status = 422;
    throw err;
  }

  const reachAvg = Math.round(reachAvgRaw);
  const engagementRateNormalized = Number.isFinite(engagementRateRaw) ? engagementRateRaw : 0;
  const engagementPercentRaw = engagementRateNormalized > 1 ? engagementRateNormalized : engagementRateNormalized * 100;
  const engagementPercent = Math.min(
    MAX_ENGAGEMENT_PERCENT,
    Math.max(MIN_ENGAGEMENT_PERCENT, engagementPercentRaw)
  );
  const engagementFactor = 1 + engagementPercent / 100;

  const { value: cpmValue, source: cpmSource } = await resolveSegmentCpm(profileSegment);
  const valorBase = (reachAvgRaw / 1000) * cpmValue;

  const brandRiskStrategyRawMultiplier = brandRiskEnabled
    ? multiplicadores.brandSize[params.brandSize] *
      multiplicadores.imageRisk[params.imageRisk] *
      multiplicadores.strategicGain[params.strategicGain] *
      multiplicadores.contentModel[params.contentModel]
    : 1;
  const brandRiskFloor = brandRiskEnabled ? BRAND_RISK_MIN_BY_IMAGE_RISK[params.imageRisk] : null;
  const brandRiskStrategyMultiplier =
    brandRiskEnabled && typeof brandRiskFloor === 'number'
      ? Math.max(brandRiskStrategyRawMultiplier, brandRiskFloor)
      : brandRiskStrategyRawMultiplier;
  const brandRiskFloorApplied =
    brandRiskEnabled && typeof brandRiskFloor === 'number' && brandRiskStrategyRawMultiplier < brandRiskFloor;

  const commonMultiplier =
    multiplicadores.exclusividade[params.exclusivity] *
    multiplicadores.usoImagem[params.usageRights] *
    multiplicadores.duracaoMidiaPaga[params.paidMediaDuration ?? 'nenhum'] *
    multiplicadores.repostTikTok[params.repostTikTok ? 'sim' : 'nao'] *
    brandRiskStrategyMultiplier *
    multiplicadores.complexidade[params.complexity] *
    multiplicadores.autoridade[params.authority] *
    multiplicadores.sazonalidade[params.seasonality] *
    engagementFactor;

  let contentUnits = 0;
  let contentJusto = 0;
  let eventPresenceJusto = 0;
  let coverageUnits = 0;
  let coverageJusto = 0;
  const hasContentDeliverables = hasAnyQuantity(params.formatQuantities);

  if (hasContentDeliverables) {
    contentUnits = params.legacyPackageMode
      ? multiplicadores.formato.pacote
      : computeWeightedUnits(params.formatQuantities);
    contentJusto = roundCurrency(valorBase * commonMultiplier * contentUnits);
  }

  if (params.deliveryType === 'conteudo' && !hasContentDeliverables) {
    const err = new Error('Selecione pelo menos uma entrega de conteudo para calcular.');
    (err as any).status = 400;
    throw err;
  }

  if (params.deliveryType === 'evento') {
    const durationMultiplier = multiplicadores.eventoDuracao[params.eventDetails.durationHours];
    eventPresenceJusto = roundCurrency(valorBase * commonMultiplier * durationMultiplier);

    coverageUnits = computeWeightedUnits(params.eventCoverageQuantities);
    coverageJusto = coverageUnits > 0 ? roundCurrency(valorBase * commonMultiplier * coverageUnits * COVERAGE_FACTOR) : 0;
  }

  const valorJustoBase = roundCurrency(contentJusto + eventPresenceJusto + coverageJusto);
  const calibrationSnapshot = calibrationEnabled
    ? await resolvePricingCalibrationForUser({
        userId,
        profileSegment,
      })
    : null;
  const calibrationFactorRaw = calibrationSnapshot?.factorRaw ?? 1;
  const calibrationFactorApplied = Math.min(CALIBRATION_FACTOR_MAX, Math.max(CALIBRATION_FACTOR_MIN, calibrationFactorRaw));
  const calibrationGuardrailApplied = Math.abs(calibrationFactorApplied - calibrationFactorRaw) > 0.0001;

  const scaledContentJusto = roundCurrency(contentJusto * calibrationFactorApplied);
  const scaledEventPresenceJusto = roundCurrency(eventPresenceJusto * calibrationFactorApplied);
  const scaledCoverageJusto = roundCurrency(coverageJusto * calibrationFactorApplied);
  const valorJusto = roundCurrency(scaledContentJusto + scaledEventPresenceJusto + scaledCoverageJusto);
  const confidenceBand: CalibrationConfidenceBand = calibrationEnabled
    ? calibrationSnapshot?.confidenceBand ?? 'baixa'
    : 'alta';
  const lowConfidenceRangeExpanded = calibrationEnabled && confidenceBand !== 'alta';
  const strategicMultiplier = confidenceBand === 'alta' ? 0.75 : confidenceBand === 'media' ? 0.7 : 0.65;
  const premiumMultiplier = confidenceBand === 'alta' ? 1.4 : confidenceBand === 'media' ? 1.5 : 1.6;

  const strategicWaiverApplied =
    brandRiskEnabled &&
    params.allowStrategicWaiver &&
    params.brandSize === 'grande' &&
    params.imageRisk === 'baixo' &&
    params.strategicGain === 'alto' &&
    params.contentModel === 'publicidade_perfil' &&
    params.usageRights === 'organico' &&
    params.exclusivity === 'nenhuma' &&
    (params.authority === 'padrao' || params.authority === 'ascensao');
  const valorEstrategico = strategicWaiverApplied ? 0 : roundCurrency(valorJusto * strategicMultiplier);
  const valorPremium = roundCurrency(valorJusto * premiumMultiplier);

  const travelCost = multiplicadores.deslocamento[params.eventDetails.travelTier];
  const hotelCost = roundCurrency(params.eventDetails.hotelNights * HOTEL_COST_PER_NIGHT);
  const logisticsSuggested = roundCurrency(travelCost + hotelCost);

  const averageDealRaw = adDealInsights?.averageDealValueBRL;
  const avgTicketValue =
    typeof averageDealRaw === 'number' && Number.isFinite(averageDealRaw) ? roundCurrency(averageDealRaw) : null;
  const totalDeals = adDealInsights?.totalDeals ?? 0;

  const explanationParts = [
    `CPM base aplicado: R$ ${cpmValue.toFixed(2)}.`,
    `Alcance medio considerado: ${reachAvg.toLocaleString('pt-BR')} pessoas.`,
    `Fator de engajamento: ${engagementFactor.toFixed(2)}x.`,
    `Exclusividade (${params.exclusivity}): ${multiplicadores.exclusividade[params.exclusivity].toFixed(2)}x.`,
    `Uso de imagem (${params.usageRights}): ${multiplicadores.usoImagem[params.usageRights].toFixed(2)}x.`,
    params.paidMediaDuration
      ? `Prazo de midia paga (${params.paidMediaDuration}): ${multiplicadores.duracaoMidiaPaga[params.paidMediaDuration].toFixed(2)}x.`
      : 'Uso organico sem prazo de midia paga.',
    params.repostTikTok
      ? `Repost no TikTok: ${multiplicadores.repostTikTok.sim.toFixed(2)}x.`
      : `Sem repost no TikTok: ${multiplicadores.repostTikTok.nao.toFixed(2)}x.`,
    brandRiskEnabled ? `Porte da marca (${params.brandSize}): ${multiplicadores.brandSize[params.brandSize].toFixed(2)}x.` : null,
    brandRiskEnabled ? `Risco de imagem (${params.imageRisk}): ${multiplicadores.imageRisk[params.imageRisk].toFixed(2)}x.` : null,
    brandRiskEnabled ? `Ganho estrategico (${params.strategicGain}): ${multiplicadores.strategicGain[params.strategicGain].toFixed(2)}x.` : null,
    brandRiskEnabled ? `Modelo de conteudo (${params.contentModel}): ${multiplicadores.contentModel[params.contentModel].toFixed(2)}x.` : null,
    brandRiskEnabled ? `Combinado marca/risco/estrategia/modelo: ${brandRiskStrategyMultiplier.toFixed(2)}x.` : null,
    brandRiskFloorApplied ? `Piso de risco aplicado para risco ${params.imageRisk}: ${(brandRiskFloor ?? 0).toFixed(2)}x.` : null,
    calibrationEnabled
      ? `Calibracao ativa: fator bruto ${calibrationFactorRaw.toFixed(2)}x, aplicado ${calibrationFactorApplied.toFixed(2)}x (guardrail ${CALIBRATION_FACTOR_MIN.toFixed(2)}-${CALIBRATION_FACTOR_MAX.toFixed(2)}x).`
      : 'Calibracao desativada: fator neutro 1.00x.',
    calibrationSnapshot
      ? `Confianca da calibracao: ${(calibrationSnapshot.confidence * 100).toFixed(1)}% (${calibrationSnapshot.confidenceBand}). Amostras segmento/creator: ${calibrationSnapshot.segmentSampleSize}/${calibrationSnapshot.creatorSampleSize}.`
      : null,
    lowConfidenceRangeExpanded
      ? `Faixa expandida por confianca ${confidenceBand}: estrategico ${strategicMultiplier.toFixed(2)}x e premium ${premiumMultiplier.toFixed(2)}x.`
      : `Faixa padrao mantida: estrategico ${strategicMultiplier.toFixed(2)}x e premium ${premiumMultiplier.toFixed(2)}x.`,
    brandRiskEnabled && params.allowStrategicWaiver ? 'Excecao estrategica habilitada para avaliar cenario de valor estrategico R$ 0.' : null,
    strategicWaiverApplied
      ? 'Excecao estrategica aplicada: valor estrategico definido em R$ 0, mantendo justo e premium como referencia comercial.'
      : null,
    params.instagramCollab
      ? 'Collab com marca no Instagram: sim (informativo, sem impacto no preco).'
      : 'Collab com marca no Instagram: nao (informativo, sem impacto no preco).',
    params.usageRights === 'organico'
      ? null
      : params.repostTikTok
        ? 'Impulsionamento valido para todas as plataformas envolvidas, incluindo Instagram e TikTok durante o periodo contratado.'
        : 'Impulsionamento valido para todas as plataformas envolvidas durante o periodo contratado.',
    hasContentDeliverables ? `Unidades ponderadas de conteudo: ${contentUnits.toFixed(2)}.` : null,
    params.deliveryType === 'evento'
      ? `Presenca em evento (${params.eventDetails.durationHours}h): ${multiplicadores.eventoDuracao[params.eventDetails.durationHours].toFixed(2)}x.`
      : null,
    params.deliveryType === 'evento' && coverageUnits > 0
      ? `Cobertura opcional aplicada: ${coverageUnits.toFixed(2)} unidades x ${COVERAGE_FACTOR.toFixed(2)}.`
      : null,
    params.deliveryType === 'evento'
      ? `Custos extras sugeridos (nao inclusos no cache): R$ ${logisticsSuggested.toFixed(2)}.`
      : null,
    params.seasonality !== 'normal'
      ? `Sazonalidade (${params.seasonality}): ${multiplicadores.sazonalidade[params.seasonality]}x.`
      : null,
    avgTicketValue ? `Ticket medio de publis recentes: R$ ${avgTicketValue.toFixed(2)}.` : null,
    totalDeals > 0 ? `Total de publis analisadas: ${totalDeals}.` : null,
  ].filter(Boolean);
  const explanationPrefix = input.explanationPrefix ? `${input.explanationPrefix.trim()} ` : '';
  const explanation = `${explanationPrefix}${explanationParts.join(' ')}`.trim();

  return {
    metrics: {
      reach: reachAvg,
      engagement: roundCurrency(engagementPercent),
      profileSegment,
    },
    params: {
      ...params,
      format: deriveLegacyFormat({
        deliveryType: params.deliveryType,
        formatQuantities: params.formatQuantities,
        legacyPackageMode: params.legacyPackageMode,
      }),
    },
    result: {
      estrategico: valorEstrategico,
      justo: valorJusto,
      premium: valorPremium,
    },
    breakdown: {
      contentUnits: roundCurrency(contentUnits),
      contentJusto: scaledContentJusto,
      eventPresenceJusto: scaledEventPresenceJusto,
      coverageUnits: roundCurrency(coverageUnits),
      coverageJusto: scaledCoverageJusto,
      travelCost,
      hotelCost,
      logisticsSuggested,
      logisticsIncludedInCache: false,
    },
    cpmApplied: cpmValue,
    cpmSource,
    calibration: {
      enabled: calibrationEnabled,
      baseJusto: valorJustoBase,
      factorRaw: roundCurrency(calibrationFactorRaw),
      factorApplied: roundCurrency(calibrationFactorApplied),
      guardrailApplied: calibrationGuardrailApplied,
      confidence: calibrationSnapshot?.confidence ?? 0,
      confidenceBand,
      segmentSampleSize: calibrationSnapshot?.segmentSampleSize ?? 0,
      creatorSampleSize: calibrationSnapshot?.creatorSampleSize ?? 0,
      windowDaysSegment: calibrationSnapshot?.windowDaysSegment ?? 180,
      windowDaysCreator: calibrationSnapshot?.windowDaysCreator ?? 365,
      lowConfidenceRangeExpanded,
      linkQuality: calibrationSnapshot?.linkQuality ?? 'low',
    },
    avgTicket: avgTicketValue,
    totalDeals,
    explanation,
  };
}
