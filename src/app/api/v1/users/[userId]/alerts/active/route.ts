import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { fetchUserAlerts } from '@/app/lib/dataService/userService';

enum AlertTypeEnum {
  FOLLOWER_STAGNATION = "FollowerStagnation",
  FORGOTTEN_FORMAT = "ForgottenFormat",
  CONTENT_PERFORMANCE_DROP = "ContentPerformanceDrop",
  NO_EVENT_FOUND_TODAY_WITH_INSIGHT = "no_event_found_today_with_insight",
}

interface AlertResponseItem {
  alertId: string;
  type: string;
  date: string;
  title: string;
  finalUserMessage: string;
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
  const dedupeParam = searchParams.get('dedupeNoEventAlerts');

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

  const dedupeNoEventAlerts = dedupeParam === 'true';

  try {
    const { alerts, totalAlerts } = await fetchUserAlerts(userId, { limit, types: filterTypes, dedupeNoEventAlerts });

    const mappedAlerts: AlertResponseItem[] = alerts.map((a) => ({
      alertId: (a._id ?? new Types.ObjectId()).toString(),
      type: a.type,
      date: (a.date instanceof Date ? a.date : new Date(a.date)).toISOString().split('T')[0]!,
      title: a.type,
      finalUserMessage: a.finalUserMessage,
      details: a.details,
    }));

    const response: UserAlertsResponse = {
      alerts: mappedAlerts,
      totalAlerts,
      insightSummary: mappedAlerts.length > 0
        ? `Você tem ${totalAlerts > limit ? 'pelo menos ' : ''}${mappedAlerts.length} alerta(s) relevante(s).`
        : 'Nenhum alerta novo.',
    };

    if (mappedAlerts.length > 0 && mappedAlerts.length < totalAlerts) {
      response.insightSummary += ` Mostrando os ${mappedAlerts.length} mais recentes de ${totalAlerts} alertas correspondentes.`;
    }

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error(`[API USER/ALERTS/ACTIVE] Error for userId ${userId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: 'Erro ao buscar alertas do usuário.', details: errorMessage }, { status: 500 });
  }
}
