import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { addDays } from '@/utils/dateHelpers';

enum AlertTypeEnum {
  FOLLOWER_STAGNATION = "FollowerStagnation",
  FORGOTTEN_FORMAT = "ForgottenFormat",
  CONTENT_PERFORMANCE_DROP = "ContentPerformanceDrop",
}

interface AlertResponseItem {
  alertId: string;
  type: string;
  date: string;
  title: string;
  summary: string;
  details: any;
}

interface UserAlertsResponse {
  alerts: AlertResponseItem[];
  totalAlerts: number;
  insightSummary?: string;
}

const ALLOWED_ALERT_TYPES = Object.values(AlertTypeEnum);

export async function GET(
  request: Request,
  { params }: { params: { userId: string } }
) {
  const { userId } = params;

  if (!userId || !Types.ObjectId.isValid(userId)) {
    return NextResponse.json({ error: "User ID inválido ou ausente." }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get('limit');
  const typesParam = searchParams.getAll('types');

  let limit = 5;
  if (limitParam) {
    const parsed = parseInt(limitParam, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 20) {
      limit = parsed;
    } else {
      return NextResponse.json({ error: "Parâmetro limit inválido. Deve ser um número positivo até 20." }, { status: 400 });
    }
  }

  const filterTypes = typesParam.filter(t => ALLOWED_ALERT_TYPES.includes(t as AlertTypeEnum));

  const todayFormatted = new Date().toISOString().split('T')[0]!;
  const yesterday = addDays(new Date(), -1);
  const yesterdayFormatted = yesterday.toISOString().split('T')[0]!;
  const fiveDaysAgo = addDays(new Date(), -5);
  const fiveDaysAgoFormatted = fiveDaysAgo.toISOString().split('T')[0]!;

  const allMockAlerts: AlertResponseItem[] = [
    {
      alertId: new Types.ObjectId().toString(),
      type: AlertTypeEnum.FOLLOWER_STAGNATION,
      date: todayFormatted,
      title: "Estagnação de Seguidores",
      summary: "Seu crescimento de seguidores desacelerou significativamente nos últimos 14 dias.",
      details: { currentGrowthRate: 0.005, previousGrowthRate: 0.02, periodDays: 14 }
    },
    {
      alertId: new Types.ObjectId().toString(),
      type: AlertTypeEnum.FORGOTTEN_FORMAT,
      date: yesterdayFormatted,
      title: "Formato Esquecido: Reels",
      summary: "Você não posta Reels há 25 dias. Este formato costumava ter bom engajamento.",
      details: { format: "REEL", daysSinceLastUsed: 25, avgMetricValue: 1500, metricName: "total_interactions" }
    },
    {
      alertId: new Types.ObjectId().toString(),
      type: AlertTypeEnum.CONTENT_PERFORMANCE_DROP,
      date: fiveDaysAgoFormatted,
      title: "Queda de Performance em Conteúdo",
      summary: "O engajamento médio dos seus últimos 5 posts de Imagem caiu 30% comparado à média anterior.",
      details: { contentType: "IMAGE", dropPercentage: -30, lastPostsCount: 5, currentAvg: 500, previousAvg: 714 }
    },
    {
      alertId: new Types.ObjectId().toString(),
      type: AlertTypeEnum.FOLLOWER_STAGNATION,
      date: addDays(new Date(), -10).toISOString().split('T')[0]!,
      title: "Estagnação de Seguidores (Antigo)",
      summary: "Seu crescimento de seguidores desacelerou (alerta mais antigo).",
      details: { currentGrowthRate: 0.008, previousGrowthRate: 0.03, periodDays: 14 }
    }
  ];

  const filtered = filterTypes.length > 0
    ? allMockAlerts.filter(alert => filterTypes.includes(alert.type))
    : allMockAlerts;

  const paginated = filtered
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit);

  const response: UserAlertsResponse = {
    alerts: paginated,
    totalAlerts: filtered.length,
    insightSummary: paginated.length > 0
      ? `Você tem ${filtered.length > limit ? 'pelo menos ' : ''}${paginated.length} alerta(s) relevante(s).`
      : "Nenhum alerta novo."
  };
  if (paginated.length > 0 && paginated.length < filtered.length) {
    response.insightSummary += ` Mostrando os ${paginated.length} mais recentes de ${filtered.length} alertas correspondentes.`;
  }

  return NextResponse.json(response, { status: 200 });
}
