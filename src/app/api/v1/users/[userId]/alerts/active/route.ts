import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
// import UserModel, { UserAlertHistoryEntry } from '@/app/models/User'; // Para implementação real
import { addDays } from '@/utils/dateHelpers'; // Importar helper compartilhado

// Tipos de Alerta (exemplo, alinhar com os tipos reais definidos no User.alertHistory)
enum AlertTypeEnum {
  FOLLOWER_STAGNATION = "FollowerStagnation",
  FORGOTTEN_FORMAT = "ForgottenFormat",
  CONTENT_PERFORMANCE_DROP = "ContentPerformanceDrop",
  // Adicionar outros tipos de alerta aqui
}

interface AlertResponseItem {
  alertId: string;
  type: string;
  date: string; // YYYY-MM-DD
  title: string;
  summary: string;
  details: any; // Conteúdo de IAlertHistoryEntry.details
}

interface UserAlertsResponse {
  alerts: AlertResponseItem[];
  totalAlerts: number; // Total de alertas correspondentes *antes* do limit
  insightSummary?: string;
}

// Lista de tipos de alerta permitidos para filtragem (pode ser expandida)
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
  // const statusParam = searchParams.get('status');
  const typesParam = searchParams.getAll('types');

  let limit = 5;
  if (limitParam) {
    const parsedLimit = parseInt(limitParam, 10);
    if (!isNaN(parsedLimit) && parsedLimit > 0 && parsedLimit <= 20) {
      limit = parsedLimit;
    } else {
      return NextResponse.json({ error: "Parâmetro limit inválido. Deve ser um número positivo até 20." }, { status: 400 });
    }
  }

  const filterTypes = typesParam.filter(type => ALLOWED_ALERT_TYPES.includes(type as AlertTypeEnum));

  // --- Simulação de Lógica de Backend ---
  // const user = await UserModel.findById(userId).select('alertHistory');
  // if (!user) {
  //   return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  // }
  // let relevantAlerts = user.alertHistory || [];
  // if (filterTypes.length > 0) {
  //   relevantAlerts = relevantAlerts.filter(alert => filterTypes.includes(alert.type));
  // }
  // relevantAlerts.sort((a, b) => b.checkedAt.getTime() - a.checkedAt.getTime());
  // const totalMatchingAlerts = relevantAlerts.length;
  // const paginatedAlerts = relevantAlerts.slice(0, limit);
  // const formattedAlerts: AlertResponseItem[] = paginatedAlerts.map(alert => ({
  //    alertId: alert._id?.toString() || new Types.ObjectId().toString(),
  //    type: alert.type,
  //    date: alert.checkedAt.toISOString().split('T')[0],
  //    title: generateAlertTitle(alert),
  //    summary: alert.finalUserMessage || generateAlertSummary(alert),
  //    details: alert.details
  // }));

  const todayFormatted = new Date().toISOString().split('T')[0];
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() -1); // Deve usar addDays para consistência, mas ok para mock
  const yesterdayFormatted = yesterday.toISOString().split('T')[0];
  const fiveDaysAgoFormatted = addDays(new Date(), -5).toISOString().split('T')[0];


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
      date: addDays(new Date(), -10).toISOString().split('T')[0],
      title: "Estagnação de Seguidores (Antigo)",
      summary: "Seu crescimento de seguidores desacelerou (alerta mais antigo).",
      details: { currentGrowthRate: 0.008, previousGrowthRate: 0.03, periodDays: 14 }
    },
  ];

  const filteredMockAlerts = filterTypes.length > 0
    ? allMockAlerts.filter(alert => filterTypes.includes(alert.type))
    : allMockAlerts;

  const paginatedAlerts = filteredMockAlerts.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, limit);


  const response: UserAlertsResponse = {
    alerts: paginatedAlerts,
    totalAlerts: filteredMockAlerts.length,
    insightSummary: paginatedAlerts.length > 0 ? `Você tem ${filteredMockAlerts.length > limit ? 'pelo menos ':''}${paginatedAlerts.length} alerta(s) relevante(s).` : "Nenhum alerta novo."
  };
  if (paginatedAlerts.length > 0 && paginatedAlerts.length < filteredMockAlerts.length) {
      response.insightSummary += ` Mostrando os ${paginatedAlerts.length} mais recentes de ${filteredMockAlerts.length} alertas correspondentes.`
  }


  return NextResponse.json(response, { status: 200 });

  // catch (error) {
  //   console.error(`[API USER/ALERTS/ACTIVE] Error for userId ${userId}:`, error);
  //   const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
  //   return NextResponse.json({ error: "Erro ao processar sua solicitação de alertas.", details: errorMessage }, { status: 500 });
  // }
}
```
