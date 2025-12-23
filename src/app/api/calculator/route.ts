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
  type CalculatorParams,
} from '@/app/lib/pricing/publiCalculator';
import { ensurePlannerAccess } from '@/app/lib/planGuard';
import { logger } from '@/app/lib/logger';

export const runtime = 'nodejs';

const ROUTE_TAG = '[POST /api/calculator]';

interface CalculatorPayload {
  format?: string;
  exclusivity?: string;
  usageRights?: string;

  complexity?: string;
  authority?: string;
  seasonality?: string;
  periodDays?: number;
  explanation?: string;
}

export async function POST(request: NextRequest) {
  const session = await getServerSession({ req: request, ...authOptions });
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

  const { format, exclusivity, usageRights, complexity, authority, seasonality = 'normal' } = payload;

  if (
    !format ||
    !exclusivity ||
    !usageRights ||
    !complexity ||
    !VALID_FORMATS.has(format) ||
    !VALID_EXCLUSIVITIES.has(exclusivity) ||
    !VALID_USAGE_RIGHTS.has(usageRights) ||

    !VALID_COMPLEXITIES.has(complexity) ||
    !authority ||
    !VALID_AUTHORITIES.has(authority) ||
    !VALID_SEASONALITIES.has(seasonality)
  ) {
    return NextResponse.json({ error: 'Parâmetros inválidos para cálculo.' }, { status: 400 });
  }

  const periodDays = Number.isFinite(payload.periodDays) && payload.periodDays! > 0 ? Math.min(payload.periodDays!, 365) : 90;

  try {
    await connectToDatabase();

    const userId = session.user.id;
    const user = (await UserModel.findById(userId).lean()) as IUser | null;
    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
    }

    const formatValue = format as CalculatorParams['format'];
    const exclusivityValue = exclusivity as CalculatorParams['exclusivity'];
    const usageRightsValue = usageRights as CalculatorParams['usageRights'];
    const complexityValue = complexity as CalculatorParams['complexity'];
    const authorityValue = authority as CalculatorParams['authority'];
    const seasonalityValue = seasonality as CalculatorParams['seasonality'];

    const calcParams: CalculatorParams = {
      format: formatValue,
      exclusivity: exclusivityValue,
      usageRights: usageRightsValue,
      complexity: complexityValue,
      authority: authorityValue,
      seasonality: seasonalityValue,
    };

    const calculationPayload = await runPubliCalculator({
      user,
      params: calcParams,
      periodDays,
      explanationPrefix: payload.explanation,
    });

    const calculation = await PubliCalculation.create({
      userId,
      metrics: calculationPayload.metrics,
      params: {
        format: formatValue,
        exclusivity: exclusivityValue,
        usageRights: usageRightsValue,
        complexity: complexityValue,
        authority: authorityValue,
        seasonality: seasonalityValue,
      },
      result: calculationPayload.result,
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
        cpm: calculationPayload.cpmApplied,
        cpmSource: calculationPayload.cpmSource,
        params: {
          format: calculation.params?.format,
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
      status === 422
        ? (error as Error).message
        : 'Erro interno ao calcular o valor sugerido.';
    logger.error(`${ROUTE_TAG} Erro inesperado`, error);
    return NextResponse.json({ error: message }, { status });
  }
}
