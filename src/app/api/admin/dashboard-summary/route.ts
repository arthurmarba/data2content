// src/app/api/admin/dashboard-summary/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/app/lib/logger';
import {
  getTotalCreatorsCount,
  getPendingCreatorsCount,
} from '@/lib/services/adminCreatorService'; // Ajuste o caminho se necessário
import { AdminDashboardSummaryData, AdminDashboardKpi } from '@/types/admin/dashboard'; // Ajuste o caminho

const SERVICE_TAG = '[api/admin/dashboard-summary]';

// Mock Admin Session Validation (substituir pela real com getServerSession)
async function getAdminSession(req: NextRequest): Promise<{ user: { name: string, role?: string, isAdmin?: boolean } } | null> {
  const mockSession = { user: { name: 'Admin User', role: 'admin' } }; // Simula um admin
  if (mockSession.user.role !== 'admin') return null;
  return mockSession;
}

function apiError(message: string, status: number): NextResponse {
  logger.error(`${SERVICE_TAG} Erro ${status}: ${message}`);
  return NextResponse.json({ error: message }, { status });
}

export async function GET(req: NextRequest) {
  const TAG = `${SERVICE_TAG}[GET]`;
  logger.info(`${TAG} Received request for dashboard summary KPIs.`);

  try {
    const session = await getAdminSession(req);
    if (!session) {
      return apiError('Acesso não autorizado ou privilégios insuficientes.', 401);
    }
    logger.info(`${TAG} Admin session validated for user: ${session.user.name}`);

    // Chamar as funções de serviço em paralelo para eficiência
    const [totalCreatorsCount, pendingCreatorsCount] = await Promise.all([
      getTotalCreatorsCount(),
      getPendingCreatorsCount(),
      // Adicionar chamadas para outros KPIs aqui, ex: getActiveAffiliatesCount()
    ]);

    // Construir o objeto de resposta no formato AdminDashboardSummaryData
    const summaryData: AdminDashboardSummaryData = {
      totalCreators: {
        id: 'totalCreators',
        label: 'Total de Criadores',
        value: totalCreatorsCount,
      },
      pendingCreators: {
        id: 'pendingCreators',
        label: 'Criadores Pendentes',
        value: pendingCreatorsCount,
      },
      // Adicionar outros KPIs aqui
      // activeAffiliates: {
      //   id: 'activeAffiliates',
      //   label: 'Afiliados Ativos',
      //   value: activeAffiliatesCount, // Supondo que esta variável exista
      // },
    };

    return NextResponse.json(summaryData, { status: 200 });

  } catch (error: any) {
    logger.error(`${TAG} Unexpected error fetching dashboard summary:`, error);
    return apiError(error.message || 'Ocorreu um erro interno ao buscar o resumo do dashboard.', 500);
  }
}
