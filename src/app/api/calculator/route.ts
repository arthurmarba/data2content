// src/app/api/calculator/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import PubliCalculation from '@/app/models/PubliCalculation';
import UserModel, { IUser } from '@/app/models/User';
import {
  runPubliCalculator,
  VALID_FORMATS,
  VALID_EXCLUSIVITIES,
  VALID_USAGE_RIGHTS,
  VALID_COMPLEXITIES,
  VALID_AUTHORITIES,
  VALID_SEASONALITIES,
  VALID_DELIVERY_TYPES,
  VALID_TRAVEL_TIERS,
  type CalculatorParamsInput,
  type EventDetails,
  type FormatQuantities,
} from '@/app/lib/pricing/publiCalculator';
import { ensurePlannerAccess } from '@/app/lib/planGuard';
import { logger } from '@/app/lib/logger';

export const runtime = 'nodejs';

const ROUTE_TAG = '[POST /api/calculator]';

type QuantityInput = Partial<Record<keyof FormatQuantities, unknown>>;

interface CalculatorPayload {
  format?: string;
  deliveryType?: string;
  formatQuantities?: QuantityInput;
  eventCoverageQuantities?: QuantityInput;
  eventDetails?: {
    durationHours?: unknown;
    travelTier?: unknown;
    hotelNights?: unknown;
  };
  exclusivity?: string;
  usageRights?: string;
  complexity?: string;
  authority?: string;
  seasonality?: string;
  periodDays?: number;
  explanation?: string;
}

const isIntegerLike = (value: unknown): boolean => {
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'string' && value.trim().length > 0) {
    return Number.isFinite(Number(value));
  }
  return false;
};

const validateQuantities = (input: QuantityInput | undefined): boolean => {
  if (!input) return true;
  const keys: Array<keyof FormatQuantities> = ['reels', 'post', 'stories'];
  return keys.every((key) => {
    const value = input[key];
    if (value === undefined || value === null || value === '') return true;
    return isIntegerLike(value);
  });
};

const toEventDurationHours = (value: unknown): EventDetails['durationHours'] | undefined => {
  const duration = Number(value);
  if (!Number.isFinite(duration)) return undefined;
  return duration === 2 || duration === 4 || duration === 8 ? duration : undefined;
};

export async function POST(request: NextRequest) {
  const session = (await getServerSession({ req: request, ...authOptions })) as any;
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const routePath = new URL(request.url).pathname;
  const access = await ensurePlannerAccess({ session, routePath, forceReload: true });
  if (!access.ok) {
    return NextResponse.json({ error: access.message, reason: access.reason }, { status: access.status });
  }
  if (!access.normalizedStatus) {
    return NextResponse.json({ error: 'Recurso disponível apenas para planos premium. Faça upgrade para continuar.' }, { status: 402 });
  }

  let payload: CalculatorPayload;
  try {
    payload = await request.json();
  } catch (error) {
    logger.warn(`${ROUTE_TAG} Corpo da requisição inválido`, error);
    return NextResponse.json({ error: 'Corpo da requisição inválido' }, { status: 400 });
  }

  const {
    format,
    deliveryType,
    formatQuantities,
    eventCoverageQuantities,
    eventDetails,
    exclusivity,
    usageRights,
    complexity,
    authority,
    seasonality = 'normal',
  } = payload;

  if (
    !exclusivity ||
    !usageRights ||
    !complexity ||
    !authority ||
    !VALID_EXCLUSIVITIES.has(exclusivity) ||
    !VALID_USAGE_RIGHTS.has(usageRights) ||
    !VALID_COMPLEXITIES.has(complexity) ||
    !VALID_AUTHORITIES.has(authority) ||
    !VALID_SEASONALITIES.has(seasonality)
  ) {
    return NextResponse.json({ error: 'Parâmetros inválidos para cálculo.' }, { status: 400 });
  }

  if (format && !VALID_FORMATS.has(format)) {
    return NextResponse.json({ error: 'Formato inválido.' }, { status: 400 });
  }

  if (deliveryType && !VALID_DELIVERY_TYPES.has(deliveryType)) {
    return NextResponse.json({ error: 'Tipo de entrega inválido.' }, { status: 400 });
  }

  if (!validateQuantities(formatQuantities) || !validateQuantities(eventCoverageQuantities)) {
    return NextResponse.json({ error: 'Quantidades inválidas para entregas.' }, { status: 400 });
  }

  const normalizedDurationHours =
    eventDetails?.durationHours !== undefined
      ? toEventDurationHours(eventDetails.durationHours)
      : undefined;

  if (eventDetails?.durationHours !== undefined && !normalizedDurationHours) {
    return NextResponse.json({ error: 'Duração do evento inválida.' }, { status: 400 });
  }

  if (eventDetails?.travelTier !== undefined) {
    if (typeof eventDetails.travelTier !== 'string' || !VALID_TRAVEL_TIERS.has(eventDetails.travelTier)) {
      return NextResponse.json({ error: 'Faixa de deslocamento inválida.' }, { status: 400 });
    }
  }

  if (eventDetails?.hotelNights !== undefined && !isIntegerLike(eventDetails.hotelNights)) {
    return NextResponse.json({ error: 'Quantidade de noites inválida.' }, { status: 400 });
  }

  const calcParamsInput: CalculatorParamsInput = {
    format: (format as CalculatorParamsInput['format']) ?? undefined,
    deliveryType: (deliveryType as CalculatorParamsInput['deliveryType']) ?? undefined,
    formatQuantities: formatQuantities as CalculatorParamsInput['formatQuantities'],
    eventCoverageQuantities: eventCoverageQuantities as CalculatorParamsInput['eventCoverageQuantities'],
    eventDetails: {
      durationHours: normalizedDurationHours,
      travelTier: eventDetails?.travelTier as EventDetails['travelTier'] | undefined,
      hotelNights:
        eventDetails?.hotelNights !== undefined
          ? Number(eventDetails.hotelNights)
          : undefined,
    },
    exclusivity: exclusivity as CalculatorParamsInput['exclusivity'],
    usageRights: usageRights as CalculatorParamsInput['usageRights'],
    complexity: complexity as CalculatorParamsInput['complexity'],
    authority: authority as CalculatorParamsInput['authority'],
    seasonality: seasonality as CalculatorParamsInput['seasonality'],
  };

  const periodDays = Number.isFinite(payload.periodDays) && payload.periodDays! > 0 ? Math.min(payload.periodDays!, 365) : 90;

  try {
    await connectToDatabase();

    const userId = session.user.id;
    const user = (await UserModel.findById(userId).lean()) as IUser | null;
    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
    }

    const calculationPayload = await runPubliCalculator({
      user,
      params: calcParamsInput,
      periodDays,
      explanationPrefix: payload.explanation,
    });

    const calculation = await PubliCalculation.create({
      userId,
      metrics: calculationPayload.metrics,
      params: calculationPayload.params,
      result: calculationPayload.result,
      breakdown: calculationPayload.breakdown,
      cpmApplied: calculationPayload.cpmApplied,
      cpmSource: calculationPayload.cpmSource,
      explanation: calculationPayload.explanation || undefined,
      avgTicket: calculationPayload.avgTicket ?? undefined,
      totalDeals: calculationPayload.totalDeals,
    });

    return NextResponse.json(
      {
        estrategico: calculationPayload.result.estrategico,
        justo: calculationPayload.result.justo,
        premium: calculationPayload.result.premium,
        breakdown: calculationPayload.breakdown,
        cpm: calculationPayload.cpmApplied,
        cpmSource: calculationPayload.cpmSource,
        params: {
          format: calculation.params?.format,
          deliveryType: calculation.params?.deliveryType,
          formatQuantities: calculation.params?.formatQuantities,
          eventDetails: calculation.params?.eventDetails,
          eventCoverageQuantities: calculation.params?.eventCoverageQuantities,
          exclusivity: calculation.params?.exclusivity,
          usageRights: calculation.params?.usageRights,
          complexity: calculation.params?.complexity,
          authority: calculation.params?.authority,
          seasonality: calculation.params?.seasonality,
        },
        metrics: {
          reach: calculationPayload.metrics.reach,
          engagement: calculationPayload.metrics.engagement,
          profileSegment: calculationPayload.metrics.profileSegment,
        },
        avgTicket: calculationPayload.avgTicket,
        totalDeals: calculationPayload.totalDeals,
        calculationId: calculation._id.toString(),
        explanation: calculationPayload.explanation || null,
        createdAt: calculation.createdAt?.toISOString?.() ?? new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    const status = (error as any)?.status || 500;
    const message =
      status === 422 || status === 400
        ? (error as Error).message
        : 'Erro interno ao calcular o valor sugerido.';
    logger.error(`${ROUTE_TAG} Erro inesperado`, error);
    return NextResponse.json({ error: message }, { status });
  }
}
