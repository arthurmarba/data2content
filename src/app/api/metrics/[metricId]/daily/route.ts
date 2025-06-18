// src/app/api/metrics/[metricId]/daily/route.ts

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/mongoose';
import DailyMetricSnapshotModel from '@/app/models/DailyMetricSnapshot';
import MetricModel from '@/app/models/Metric'; // Importar MetricModel para verificar propriedade
import mongoose, { Types } from 'mongoose'; // <<< CORRIGIDO: Importa mongoose e Types
import { logger } from '@/app/lib/logger';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

async function getUserIdFromRequest(request: Request): Promise<Types.ObjectId | null> {
  const session = await getServerSession({ req: request, ...authOptions });
  const sessionId = session?.user?.id;
  if (!sessionId) {
    return null;
  }
  if (mongoose.isValidObjectId(sessionId)) {
    return new Types.ObjectId(sessionId);
  }
  logger.warn(`[getUserIdFromRequest] ID da sessão inválido: ${sessionId}`);
  return null;
}


/**
 * GET Handler para buscar o histórico de snapshots diários de uma métrica específica.
 * Rota: GET /api/metrics/[metricId]/daily
 * Parâmetros:
 * - metricId (na URL): O ID do documento Metric.
 * Retorna:
 * - 200 OK: Com um array de snapshots diários.
 * - 400 Bad Request: Se o metricId for inválido.
 * - 401 Unauthorized: Se o usuário não estiver autenticado.
 * - 403 Forbidden: Se a métrica não pertencer ao usuário autenticado.
 * - 404 Not Found: Se a métrica com o ID fornecido não for encontrada.
 * - 500 Internal Server Error: Para erros inesperados.
 */
export async function GET(
  request: Request,
  { params }: { params: { metricId: string } }
) {
  const TAG = '[API GET /metrics/:metricId/daily]';
  const { metricId } = params;

  // 1. Autenticação: Obter ID do usuário logado
  let userId: Types.ObjectId | null;
  try {
    userId = await getUserIdFromRequest(request);
    if (!userId) {
      logger.warn(`${TAG} Usuário não autenticado.`);
      return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
    }
    logger.info(`${TAG} Requisição recebida para Metric ${metricId} por User ${userId}`);
  } catch (authError) {
    logger.error(`${TAG} Erro ao obter ID do usuário:`, authError);
    return NextResponse.json({ message: 'Erro interno no servidor (auth)' }, { status: 500 });
  }


  // 2. Validação do Parâmetro metricId
  if (!metricId || !mongoose.isValidObjectId(metricId)) { // <<< CORRIGIDO: Usa mongoose.isValidObjectId
    logger.warn(`${TAG} Metric ID inválido fornecido: ${metricId}`);
    return NextResponse.json({ message: 'ID da métrica inválido' }, { status: 400 });
  }
  const objectMetricId = new Types.ObjectId(metricId);


  try {
    await connectToDatabase();

    // 3. Autorização: Verificar se a Métrica pertence ao Usuário
    // Busca o MetricModel apenas para garantir que o usuário tem permissão
    const metricOwnerCheck = await MetricModel.findOne({ _id: objectMetricId, user: userId })
      .select('_id') // Seleciona apenas o _id para otimizar
      .lean();

    if (!metricOwnerCheck) {
      // Pode ser que a métrica não exista (404) ou não pertença ao usuário (403)
      // Verificamos se a métrica existe para dar o status correto
      const metricExists = await MetricModel.findById(objectMetricId).select('_id').lean();
      if (!metricExists) {
          logger.warn(`${TAG} Métrica ${metricId} não encontrada.`);
          return NextResponse.json({ message: 'Métrica não encontrada' }, { status: 404 });
      } else {
          logger.warn(`${TAG} Usuário ${userId} tentou acessar Metric ${metricId} que não lhe pertence.`);
          return NextResponse.json({ message: 'Acesso proibido' }, { status: 403 });
      }
    }

    logger.debug(`${TAG} Autorização confirmada para User ${userId} acessar Metric ${metricId}. Buscando snapshots...`);

    // 4. Busca dos Snapshots Diários
    const snapshots = await DailyMetricSnapshotModel.find({ metric: objectMetricId })
      .sort({ date: 1 }) // Ordena do mais antigo para o mais recente
      .select( // Seleciona os campos desejados para a resposta
        'date ' +
        'dailyViews dailyLikes dailyComments dailyShares dailySaved dailyReach dailyFollows dailyProfileVisits ' +
        'cumulativeViews cumulativeLikes cumulativeComments cumulativeShares cumulativeSaved cumulativeReach cumulativeFollows cumulativeProfileVisits cumulativeTotalInteractions ' +
        '-_id' // Exclui o _id de cada snapshot
      )
      .lean(); // Retorna objetos JS puros

    logger.info(`${TAG} Encontrados ${snapshots.length} snapshots diários para Metric ${metricId}.`);

    // 5. Retornar os dados
    // Formata a data para YYYY-MM-DD antes de enviar, se necessário pelo frontend
    const formattedSnapshots = snapshots.map(snap => ({
        ...snap,
        date: snap.date.toISOString().split('T')[0] // Garante formato YYYY-MM-DD
    }));

    return NextResponse.json(formattedSnapshots, { status: 200 });

  } catch (error) {
    logger.error(`${TAG} Erro inesperado ao buscar snapshots diários para Metric ${metricId}:`, error);
    return NextResponse.json({ message: 'Erro interno no servidor' }, { status: 500 });
  }
}
