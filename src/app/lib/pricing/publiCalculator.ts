import 'server-only';

import { subDays } from 'date-fns';

import type { IUser } from '@/app/models/User';
import { fetchAndPrepareReportData, getAdDealInsights } from '@/app/lib/dataService';
import { resolveSegmentCpm } from '@/app/lib/cpmBySegment';
import { logger } from '@/app/lib/logger';

export const VALID_FORMATS = new Set(['post', 'reels', 'stories', 'pacote']);
export const VALID_EXCLUSIVITIES = new Set(['nenhuma', '7d', '15d', '30d']);
export const VALID_USAGE_RIGHTS = new Set(['organico', 'midiapaga', 'global']);
export const VALID_COMPLEXITIES = new Set(['simples', 'roteiro', 'profissional']);
export const VALID_AUTHORITIES = new Set(['padrao', 'ascensao', 'autoridade', 'celebridade']);
export const VALID_SEASONALITIES = new Set(['normal', 'alta', 'baixa']);

export type CalculatorParams = {
  format: 'post' | 'reels' | 'stories' | 'pacote';
  exclusivity: 'nenhuma' | '7d' | '15d' | '30d';
  usageRights: 'organico' | 'midiapaga' | 'global';
  complexity: 'simples' | 'roteiro' | 'profissional';
  authority: 'padrao' | 'ascensao' | 'autoridade' | 'celebridade';
  seasonality: 'normal' | 'alta' | 'baixa';
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
  cpmApplied: number;
  cpmSource: 'seed' | 'dynamic';
  avgTicket: number | null;
  totalDeals: number;
  explanation: string;
};

const roundCurrency = (value: number): number => Math.round(value * 100) / 100;

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
  sazonalidade: {
    normal: 1.0,
    alta: 1.2,
    baixa: 0.9,
  },
} as const;

export const PRICING_MULTIPLIERS = multiplicadores;

type PubliCalculatorInput = {
  user: IUser;
  params: CalculatorParams;
  periodDays?: number;
  explanationPrefix?: string;
};

export async function runPubliCalculator(input: PubliCalculatorInput): Promise<PubliCalculatorResult> {
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

  const ajuste =
    multiplicadores.formato[input.params.format] *
    multiplicadores.exclusividade[input.params.exclusivity] *
    multiplicadores.usoImagem[input.params.usageRights] *
    multiplicadores.complexidade[input.params.complexity] *
    multiplicadores.autoridade[input.params.authority] *
    multiplicadores.sazonalidade[input.params.seasonality] *
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
    `Alcance medio considerado: ${reachAvg.toLocaleString('pt-BR')} pessoas.`,
    `Fator de engajamento: ${engagementFactor.toFixed(2)}x.`,
    input.params.seasonality !== 'normal'
      ? `Sazonalidade (${input.params.seasonality}): ${multiplicadores.sazonalidade[input.params.seasonality]}x.`
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
    params: input.params,
    result: {
      estrategico: valorEstrategico,
      justo: valorJusto,
      premium: valorPremium,
    },
    cpmApplied: cpmValue,
    cpmSource,
    avgTicket: avgTicketValue,
    totalDeals,
    explanation,
  };
}
