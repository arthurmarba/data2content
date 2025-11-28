// src/app/api/calculator/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import PubliCalculation from '@/app/models/PubliCalculation';
import UserModel, { IUser } from '@/app/models/User';
import { fetchAndPrepareReportData, getAdDealInsights } from '@/app/lib/dataService';
import { resolveSegmentCpm } from '@/app/lib/cpmBySegment';
import { ensurePlannerAccess } from '@/app/lib/planGuard';
import { subDays } from 'date-fns';
import { logger } from '@/app/lib/logger';

export const runtime = 'nodejs';

const ROUTE_TAG = '[POST /api/calculator]';

const VALID_FORMATS = new Set(['post', 'reels', 'stories', 'pacote']);
const VALID_EXCLUSIVITIES = new Set(['nenhuma', '7d', '15d', '30d']);
const VALID_USAGE_RIGHTS = new Set(['organico', 'midiapaga', 'global']);

const VALID_COMPLEXITIES = new Set(['simples', 'roteiro', 'profissional']);
const VALID_AUTHORITIES = new Set(['padrao', 'ascensao', 'autoridade', 'celebridade']);

interface CalculatorPayload {
  format?: string;
  exclusivity?: string;
  usageRights?: string;

  complexity?: string;
  authority?: string;
  periodDays?: number;
  explanation?: string;
}

const roundCurrency = (value: number): number => Math.round(value * 100) / 100;

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

  const { format, exclusivity, usageRights, complexity, authority } = payload;

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
    !VALID_AUTHORITIES.has(authority)
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

    const sinceDate = subDays(new Date(), periodDays);
    const [{ enrichedReport }, adDealInsights] = await Promise.all([
      fetchAndPrepareReportData({ user, analysisSinceDate: sinceDate }),
      getAdDealInsights(userId, periodDays <= 30 ? 'last30d' : periodDays <= 90 ? 'last90d' : 'all').catch((err) => {
        logger.error(`${ROUTE_TAG} Falha ao buscar insights de AdDeals`, err);
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
      return NextResponse.json({ error: 'Métricas insuficientes para calcular o valor sugerido. Registre novos conteúdos e tente novamente.' }, { status: 422 });
    }

    const reachAvg = Math.round(reachAvgRaw);
    const engagementRateNormalized = Number.isFinite(engagementRateRaw) ? engagementRateRaw : 0;
    const engagementPercent = engagementRateNormalized > 1 ? engagementRateNormalized : engagementRateNormalized * 100;
    const engagementFactor = 1 + engagementPercent / 100;

    const { value: cpmValue, source: cpmSource } = await resolveSegmentCpm(profileSegment);
    const valorBase = (reachAvgRaw / 1000) * cpmValue;

    const multiplicadores = {
      formato: {
        post: 1.0,
        reels: 1.4,
        stories: 0.8,
        pacote: 1.6,
      },
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
    } as const;

    const formatKey = format as keyof typeof multiplicadores.formato;
    const exclusivityKey = exclusivity as keyof typeof multiplicadores.exclusividade;
    const usageRightsKey = usageRights as keyof typeof multiplicadores.usoImagem;
    const complexityKey = complexity as keyof typeof multiplicadores.complexidade;
    const authorityKey = authority as keyof typeof multiplicadores.autoridade;

    const ajuste =
      multiplicadores.formato[formatKey] *
      multiplicadores.exclusividade[exclusivityKey] *
      multiplicadores.usoImagem[usageRightsKey] *
      multiplicadores.complexidade[complexityKey] *
      multiplicadores.autoridade[authorityKey] *
      engagementFactor;

    const valorJusto = roundCurrency(valorBase * ajuste);
    const valorEstrategico = roundCurrency(valorJusto * 0.75);
    const valorPremium = roundCurrency(valorJusto * 1.4);

    const averageDealRaw = adDealInsights?.averageDealValueBRL;
    const avgTicketValue =
      typeof averageDealRaw === 'number' && Number.isFinite(averageDealRaw) ? roundCurrency(averageDealRaw) : null;
    const totalDeals = adDealInsights?.totalDeals ?? 0;

    const explanationParts = [
      `CPM base aplicado: R$ ${cpmValue.toFixed(2)}.`,
      `Alcance médio considerado: ${reachAvg.toLocaleString('pt-BR')} pessoas.`,
      `Fator de engajamento: ${engagementFactor.toFixed(2)}x.`,
      avgTicketValue ? `Ticket médio de publis recentes: R$ ${avgTicketValue.toFixed(2)}.` : null,
      totalDeals > 0 ? `Total de publis analisadas: ${totalDeals}.` : null,
    ].filter(Boolean);
    const explanationPrefix = payload.explanation ? `${payload.explanation.trim()} ` : '';
    const explanation = `${explanationPrefix}${explanationParts.join(' ')}`.trim();

    const calculation = await PubliCalculation.create({
      userId,
      metrics: {
        reach: reachAvg,
        engagement: roundCurrency(engagementPercent),
        profileSegment,
      },
      params: {
        format,
        exclusivity,
        usageRights,
        complexity,
        authority,
      },
      result: {
        estrategico: valorEstrategico,
        justo: valorJusto,
        premium: valorPremium,
      },
      cpmApplied: cpmValue,
      cpmSource,
      explanation: explanation || undefined,
      avgTicket: avgTicketValue ?? undefined,
      totalDeals,
    });

    return NextResponse.json(
      {
        estrategico: valorEstrategico,
        justo: valorJusto,
        premium: valorPremium,
        cpm: cpmValue,
        cpmSource,
        params: {
          format: calculation.params?.format,
          exclusivity: calculation.params?.exclusivity,
          usageRights: calculation.params?.usageRights,
          complexity: calculation.params?.complexity,
          authority: calculation.params?.authority,
        },
        metrics: {
          reach: reachAvg,
          engagement: roundCurrency(engagementPercent),
          profileSegment,
        },
        avgTicket: avgTicketValue,
        totalDeals,
        calculationId: calculation._id.toString(),
        explanation: explanation || null,
        createdAt: calculation.createdAt?.toISOString?.() ?? new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error(`${ROUTE_TAG} Erro inesperado`, error);
    return NextResponse.json({ error: 'Erro interno ao calcular o valor sugerido.' }, { status: 500 });
  }
}
