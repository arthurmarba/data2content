import type { CalculatorFormat, DeliveryType, EventDetails, FormatQuantities, PubliCalculatorBreakdown } from '@/app/lib/pricing/publiCalculator';

const serializeNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const clampToRange = (value: unknown, min: number, max: number): number => {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return min;
  if (numeric < min) return min;
  if (numeric > max) return max;
  return Math.trunc(numeric);
};

const sanitizeFormatQuantities = (value: any, fallback: FormatQuantities): FormatQuantities => ({
  reels: clampToRange(value?.reels ?? fallback.reels, 0, 20),
  post: clampToRange(value?.post ?? fallback.post, 0, 20),
  stories: clampToRange(value?.stories ?? fallback.stories, 0, 20),
});

const mapLegacyFormatToQuantities = (format?: string | null): FormatQuantities => {
  switch (format) {
    case 'reels':
      return { reels: 1, post: 0, stories: 0 };
    case 'post':
      return { reels: 0, post: 1, stories: 0 };
    case 'stories':
      return { reels: 0, post: 0, stories: 1 };
    default:
      return { reels: 1, post: 0, stories: 0 };
  }
};

const sanitizeDeliveryType = (rawDeliveryType: unknown, rawFormat: unknown): DeliveryType => {
  if (rawDeliveryType === 'conteudo' || rawDeliveryType === 'evento') return rawDeliveryType;
  if (rawFormat === 'evento') return 'evento';
  return 'conteudo';
};

const sanitizeFormat = (value: unknown, deliveryType: DeliveryType, quantities: FormatQuantities): CalculatorFormat => {
  if (deliveryType === 'evento') return 'evento';
  if (value === 'reels' || value === 'post' || value === 'stories' || value === 'pacote') {
    if (value !== 'pacote') {
      const expected = mapLegacyFormatToQuantities(value);
      if (
        quantities.reels === expected.reels &&
        quantities.post === expected.post &&
        quantities.stories === expected.stories
      ) {
        return value;
      }
    }
    if (value === 'pacote') return 'pacote';
  }

  const active = Object.entries(quantities).filter(([, qty]) => qty > 0);
  const singleActive = active[0];
  if (active.length === 1 && singleActive && singleActive[1] === 1) {
    return singleActive[0] as CalculatorFormat;
  }
  return 'pacote';
};

const sanitizeEventDetails = (value: any): EventDetails => {
  const duration = clampToRange(value?.durationHours ?? 4, 2, 8);
  const durationHours: EventDetails['durationHours'] = duration === 2 || duration === 8 ? duration : 4;
  const travelTier: EventDetails['travelTier'] =
    value?.travelTier === 'nacional' || value?.travelTier === 'internacional' ? value.travelTier : 'local';

  return {
    durationHours,
    travelTier,
    hotelNights: clampToRange(value?.hotelNights ?? 0, 0, 20),
  };
};

const sanitizeBreakdown = (value: any): PubliCalculatorBreakdown => ({
  contentUnits: serializeNumber(value?.contentUnits) ?? 0,
  contentJusto: serializeNumber(value?.contentJusto) ?? 0,
  eventPresenceJusto: serializeNumber(value?.eventPresenceJusto) ?? 0,
  coverageUnits: serializeNumber(value?.coverageUnits) ?? 0,
  coverageJusto: serializeNumber(value?.coverageJusto) ?? 0,
  travelCost: serializeNumber(value?.travelCost) ?? 0,
  hotelCost: serializeNumber(value?.hotelCost) ?? 0,
  logisticsSuggested: serializeNumber(value?.logisticsSuggested) ?? 0,
  logisticsIncludedInCache: false,
});

export function serializeCalculation(calculation: any) {
  const deliveryType = sanitizeDeliveryType(calculation?.params?.deliveryType, calculation?.params?.format);
  const formatQuantities = sanitizeFormatQuantities(
    calculation?.params?.formatQuantities,
    mapLegacyFormatToQuantities(calculation?.params?.format)
  );
  const format = sanitizeFormat(calculation?.params?.format, deliveryType, formatQuantities);
  const eventCoverageQuantities = sanitizeFormatQuantities(calculation?.params?.eventCoverageQuantities, {
    reels: 0,
    post: 0,
    stories: 0,
  });
  const eventDetails = sanitizeEventDetails(calculation?.params?.eventDetails);

  return {
    estrategico: serializeNumber(calculation?.result?.estrategico) ?? 0,
    justo: serializeNumber(calculation?.result?.justo) ?? 0,
    premium: serializeNumber(calculation?.result?.premium) ?? 0,
    breakdown: sanitizeBreakdown(calculation?.breakdown),
    cpm: serializeNumber(calculation?.cpmApplied) ?? 0,
    cpmSource: calculation?.cpmSource ?? 'dynamic',
    params: {
      format,
      deliveryType,
      formatQuantities,
      eventDetails,
      eventCoverageQuantities,
      exclusivity: calculation?.params?.exclusivity ?? null,
      usageRights: calculation?.params?.usageRights ?? null,
      complexity: calculation?.params?.complexity ?? null,
      authority: calculation?.params?.authority ?? null,
      seasonality: calculation?.params?.seasonality ?? null,
    },
    metrics: {
      reach: serializeNumber(calculation?.metrics?.reach) ?? 0,
      engagement: serializeNumber(calculation?.metrics?.engagement) ?? 0,
      profileSegment: calculation?.metrics?.profileSegment ?? 'default',
    },
    avgTicket: serializeNumber(calculation?.avgTicket),
    totalDeals: typeof calculation?.totalDeals === 'number' ? calculation.totalDeals : 0,
    calculationId: calculation?._id?.toString?.() ?? '',
    explanation: calculation?.explanation ?? null,
    createdAt: calculation?.createdAt ? new Date(calculation.createdAt).toISOString() : null,
  };
}
