import { NextRequest, NextResponse } from 'next/server';
import UserModel from '@/app/models/User'; // Descomentado para contagem real
import { connectToDatabase } from '@/app/lib/mongoose'; // Added
import { logger } from '@/app/lib/logger'; // Added
import { getAgencySession } from '@/lib/getAgencySession';
export const dynamic = 'force-dynamic';


// Interface para a resposta do endpoint
interface PlatformKpisSummaryResponse {
  totalActiveCreators: number;
  // Adicionar outras KPIs de resumo da plataforma aqui no futuro, se necessário
  // totalPostsLast30Days: number;
  // totalEngagementLast30Days: number;
  insightSummary?: string;
}

export async function GET(
  request: NextRequest
) {
  const session = await getAgencySession(request);
  if (!session || !session.user || !session.user.agencyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    await connectToDatabase(); // Added

    // Definição de "criador ativo" - pode ser ajustada conforme as regras de negócio
    // Exemplo: status não é 'inactive' ou 'suspended', e teve atividade recente (não implementado aqui)
    const activeCreatorCriteria = {
      agency: session.user.agencyId,
      // status: { $nin: ['inactive', 'suspended', 'pending_approval'] },
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

