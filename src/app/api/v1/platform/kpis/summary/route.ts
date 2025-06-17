import { NextResponse } from 'next/server';
import UserModel from '@/app/models/User'; // Descomentado para contagem real
import { connectToDatabase } from '@/app/lib/mongoose'; // Added
import { logger } from '@/app/lib/logger'; // Added

// Interface para a resposta do endpoint
interface PlatformKpisSummaryResponse {
  totalActiveCreators: number;
  // Adicionar outras KPIs de resumo da plataforma aqui no futuro, se necessário
  // totalPostsLast30Days: number;
  // totalEngagementLast30Days: number;
  insightSummary?: string;
}

export async function GET(
  request: Request
) {
  try {
    await connectToDatabase(); // Added

    // Definição de "criador ativo" - pode ser ajustada conforme as regras de negócio
    // Exemplo: status não é 'inactive' ou 'suspended', e teve atividade recente (não implementado aqui)
    const activeCreatorCriteria = {
      // status: { $nin: ['inactive', 'suspended', 'pending_approval'] }, // Exemplo
      // lastActivityAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Ex: ativo nos últimos 30 dias
      // Para este exemplo, vamos apenas contar todos os usuários como "ativos" para simplificar,
      // já que não temos campos como 'status' ou 'lastActivityAt' definidos no UserModel mockado.
      // Em um sistema real, estes critérios seriam importantes.
    };

    const activeCreatorsCount = await UserModel.countDocuments(activeCreatorCriteria);

    const response: PlatformKpisSummaryResponse = {
      totalActiveCreators: activeCreatorsCount,
      insightSummary: `Total de ${activeCreatorsCount.toLocaleString()} criadores na plataforma.`
                       // Poderia adicionar "ativos" se os critérios fossem mais específicos.
    };
    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    logger.error("[API PLATFORM/KPIS/SUMMARY] Error fetching platform summary KPIs:", error); // Replaced console.error
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    // Retornar um valor padrão ou um erro claro se a contagem falhar
    return NextResponse.json({
        error: "Erro ao buscar KPIs da plataforma.",
        details: errorMessage,
        totalActiveCreators: null, // Indicar que o valor não pôde ser obtido
        insightSummary: "Não foi possível obter o número total de criadores."
    }, { status: 500 });
  }
}

