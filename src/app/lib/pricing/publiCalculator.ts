import { subDays } from 'date-fns/subDays';

import type { IUser } from '@/app/models/User';
import { fetchAndPrepareReportData, getAdDealInsights } from '@/app/lib/dataService';
import { resolveSegmentCpm } from '@/app/lib/cpmBySegment';
import { logger } from '@/app/lib/logger';

export const VALID_FORMATS = new Set(['post', 'reels', 'stories', 'pacote', 'evento']);
export const VALID_EXCLUSIVITIES = new Set(['nenhuma', '7d', '15d', '30d']);
export const VALID_USAGE_RIGHTS = new Set(['organico', 'midiapaga', 'global']);
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

export type CalculatorParams = {
  format: CalculatorFormat;
  deliveryType: DeliveryType;
  formatQuantities: FormatQuantities;
  eventDetails: EventDetails;
  eventCoverageQuantities: FormatQuantities;
  exclusivity: 'nenhuma' | '7d' | '15d' | '30d';
  usageRights: 'organico' | 'midiapaga' | 'global';
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

const multiplicadores = {
  formato: FORMAT_MULTIPLIERS,
  exclusividade: {
    nenhuma: 1.0,
    '7d': 1.1,
    '15d': 1.2,
    '30d': 1.3,
  },
  usoImagem: {
    organico: 1.0,
    midiapaga: 1.2,
    global: 1.4,
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
    : mapLegacyFormatToQuantities(input.format);

  const formatQuantities =
    inferredDeliveryType === 'conteudo'
      ? hasAnyQuantity(baseFormatQuantities)
        ? baseFormatQuantities
        : { ...ZERO_FORMAT_QUANTITIES }
      : { ...ZERO_FORMAT_QUANTITIES };

  const eventCoverageQuantities =
    inferredDeliveryType === 'evento'
      ? sanitizeFormatQuantities(input.eventCoverageQuantities, ZERO_FORMAT_QUANTITIES)
      : { ...ZERO_FORMAT_QUANTITIES };

  const eventDetails = sanitizeEventDetails(input.eventDetails);

  const baseParams: Omit<CalculatorParams, 'format'> = {
    deliveryType: inferredDeliveryType,
    formatQuantities,
    eventDetails,
    eventCoverageQuantities,
    exclusivity: input.exclusivity,
    usageRights: input.usageRights,
    complexity: input.complexity,
    authority: input.authority,
    seasonality: input.seasonality ?? 'normal',
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
};

export async function runPubliCalculator(input: PubliCalculatorInput): Promise<PubliCalculatorResult> {
  const params = normalizeCalculatorParams(input.params);

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
  const engagementPercent = engagementRateNormalized > 1 ? engagementRateNormalized : engagementRateNormalized * 100;
  const engagementFactor = 1 + engagementPercent / 100;

  const { value: cpmValue, source: cpmSource } = await resolveSegmentCpm(profileSegment);
  const valorBase = (reachAvgRaw / 1000) * cpmValue;

  const commonMultiplier =
    multiplicadores.exclusividade[params.exclusivity] *
    multiplicadores.usoImagem[params.usageRights] *
    multiplicadores.complexidade[params.complexity] *
    multiplicadores.autoridade[params.authority] *
    multiplicadores.sazonalidade[params.seasonality] *
    engagementFactor;

  let contentUnits = 0;
  let contentJusto = 0;
  let eventPresenceJusto = 0;
  let coverageUnits = 0;
  let coverageJusto = 0;

  if (params.deliveryType === 'conteudo') {
    contentUnits = params.legacyPackageMode
      ? multiplicadores.formato.pacote
      : computeWeightedUnits(params.formatQuantities);

    if (contentUnits <= 0) {
      const err = new Error('Selecione pelo menos uma entrega de conteudo para calcular.');
      (err as any).status = 400;
      throw err;
    }

    contentJusto = roundCurrency(valorBase * commonMultiplier * contentUnits);
  } else {
    const durationMultiplier = multiplicadores.eventoDuracao[params.eventDetails.durationHours];
    eventPresenceJusto = roundCurrency(valorBase * commonMultiplier * durationMultiplier);

    coverageUnits = computeWeightedUnits(params.eventCoverageQuantities);
    coverageJusto = coverageUnits > 0 ? roundCurrency(valorBase * commonMultiplier * coverageUnits * COVERAGE_FACTOR) : 0;
  }

  const valorJusto = roundCurrency(contentJusto + eventPresenceJusto + coverageJusto);
  const valorEstrategico = roundCurrency(valorJusto * 0.75);
  const valorPremium = roundCurrency(valorJusto * 1.4);

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
    params.deliveryType === 'conteudo'
      ? `Unidades ponderadas de conteudo: ${contentUnits.toFixed(2)}.`
      : `Presenca em evento (${params.eventDetails.durationHours}h): ${multiplicadores.eventoDuracao[params.eventDetails.durationHours].toFixed(2)}x.`,
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
      contentJusto,
      eventPresenceJusto,
      coverageUnits: roundCurrency(coverageUnits),
      coverageJusto,
      travelCost,
      hotelCost,
      logisticsSuggested,
      logisticsIncludedInCache: false,
    },
    cpmApplied: cpmValue,
    cpmSource,
    avgTicket: avgTicketValue,
    totalDeals,
    explanation,
  };
}
