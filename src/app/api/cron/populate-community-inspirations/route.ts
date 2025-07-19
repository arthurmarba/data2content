// @/app/api/cron/populate-community-inspirations/route.ts - v1.0.0 (Comunidade de Inspiração)
// - CRON Job para buscar posts elegíveis de usuários opt-in e adicioná-los ao CommunityInspirationModel.

import { NextRequest, NextResponse } from 'next/server';
import { Receiver } from "@upstash/qstash";
import { logger } from '@/app/lib/logger';
import { connectToDatabase } from '@/app/lib/mongoose';
import User, { IUser } from '@/app/models/User'; // IUser v1.9.0+
import { IMetric } from '@/app/models/Metric'; // IMetric v1.3+
import * as dataService from '@/app/lib/dataService'; // dataService v2.12.0+
import type { CommunityPerformanceCriteria } from '@/app/lib/dataService';
import * as communityProcessorService from '@/app/lib/communityProcessorService'; // communityProcessorService v1.0.0+
import { subDays } from 'date-fns';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// --- INICIALIZAÇÃO DO QSTASH RECEIVER ---
const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
let receiver: Receiver | null = null;
let initError: string | null = null;

if (!currentSigningKey || !nextSigningKey) {
    initError = "Chaves de assinatura QStash (CURRENT ou NEXT) não definidas no ambiente.";
    logger.error(`[Cron PopulateInspirations Init] ${initError}`);
} else {
    receiver = new Receiver({
        currentSigningKey: currentSigningKey,
        nextSigningKey: nextSigningKey,
    });
}
// --- FIM DA INICIALIZAÇÃO ---

// Configurações para a busca de posts elegíveis
const RECENT_POST_WINDOW_DAYS = 90; // Considerar posts dos últimos 90 dias
const MAX_POSTS_TO_PROCESS_PER_USER = 10; // Limite para não sobrecarregar em uma única execução por usuário
const MAX_USERS_TO_PROCESS_PER_RUN = 50; // Limite de usuários a processar por execução do CRON
const DEFAULT_PERFORMANCE_CRITERIA: CommunityPerformanceCriteria = {
    // A post must have at least three shares and a minimum save rate of
    // 0.2% (saved / reach) to be considered for the community feed.
    minShares: 3,
    minSaveRate: 0.002,
};

/**
 * POST /api/cron/populate-community-inspirations
 * Endpoint chamado pelo QStash Cron Job.
 */
export async function POST(request: NextRequest) {
  const TAG = '[Cron PopulateInspirations v1.0.0]';
  const overallStartTime = Date.now();

  if (!receiver) {
      logger.error(`${TAG} Erro na inicialização do QStash Receiver: ${initError}`);
      return NextResponse.json({ error: `Configuration error: ${initError}` }, { status: 500 });
  }

  try {
    const signature = request.headers.get('upstash-signature');
    if (!signature) {
        logger.error(`${TAG} Header 'upstash-signature' ausente.`);
        return NextResponse.json({ error: 'Missing signature header' }, { status: 401 });
    }
    const bodyText = await request.text(); // Corpo pode ser vazio para CRONs
    const isValid = await receiver.verify({ signature, body: bodyText });

    if (!isValid) {
      logger.error(`${TAG} Assinatura inválida recebida do Cron Job.`);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
    logger.info(`${TAG} Assinatura QStash verificada. Iniciando processo de população de inspirações...`);

    await connectToDatabase();
    logger.debug(`${TAG} Conectado ao banco de dados.`);

    // Buscar usuários que optaram por participar da comunidade
    const optedInUsers = await User.find({
        communityInspirationOptIn: true,
        isInstagramConnected: true // Apenas usuários com Instagram conectado
    })
    .select('_id name followers_count') // Campos necessários para o processamento
    .limit(MAX_USERS_TO_PROCESS_PER_RUN) // Limitar o número de usuários por execução
    .lean();

    logger.info(`${TAG} Encontrados ${optedInUsers.length} usuários com opt-in na comunidade para processar.`);

    if (optedInUsers.length === 0) {
        logger.info(`${TAG} Nenhum usuário elegível para processar. Encerrando.`);
        return NextResponse.json({ success: true, message: "No eligible users to process." }, { status: 200 });
    }

    let totalEligibleMetricsFound = 0;
    let totalInspirationsProcessed = 0; // Adicionadas ou atualizadas
    let totalErrorsProcessingMetrics = 0;

    const sinceDate = subDays(new Date(), RECENT_POST_WINDOW_DAYS);

    for (const user of optedInUsers) {
        const userProcessStartTime = Date.now();
        logger.info(`${TAG} Processando usuário ${user._id} (${user.name || 'Sem Nome'})...`);
        try {
            // Buscar posts elegíveis deste usuário
            // A lógica de 'minPerformanceCriteria' em findUserPostsEligibleForCommunity
            // ainda é um TODO, por enquanto busca posts recentes e classificados.
            const {
                posts: eligibleMetrics,
                query: debugQuery,
                sinceDate: debugSinceDate
            } = await dataService.findUserPostsEligibleForCommunity(
                user._id.toString(),
                { sinceDate, minPerformanceCriteria: DEFAULT_PERFORMANCE_CRITERIA }
            );
            
            totalEligibleMetricsFound += eligibleMetrics.length;
            logger.debug(`${TAG} User ${user._id}: Encontradas ${eligibleMetrics.length} métricas elegíveis (recentes/classificadas).`);

            if (eligibleMetrics.length === 0) {
                logger.info(`${TAG} User ${user._id}: Nenhuma métrica nova/elegível encontrada para processar. Query=${JSON.stringify(debugQuery)} sinceDate=${debugSinceDate.toISOString()}`);
                continue;
            }

            // Limitar o número de posts processados por usuário nesta execução
            const metricsToProcess = eligibleMetrics.slice(0, MAX_POSTS_TO_PROCESS_PER_USER);

            for (const metric of metricsToProcess) {
                const metricProcessStartTime = Date.now();
                try {
                    logger.debug(`${TAG} User ${user._id}: Processando Metric ${metric._id} (Post IG: ${metric.instagramMediaId || 'N/A'})...`);
                    
                    // Verificar se já existe uma inspiração para este post para evitar reprocessamento desnecessário
                    // A função addInspiration em dataService já tem uma lógica para evitar duplicatas e atualizar.
                    // O communityProcessorService é o que gasta mais recursos (chamada OpenAI).
                    // Poderíamos adicionar uma checagem aqui para não chamar o processor se já existe e não precisa atualizar.
                    // Por ora, deixamos o addInspiration lidar com a lógica de upsert.

                    const inspirationDataPartial = await communityProcessorService.processMetricForCommunity(
                        metric,
                        user as IUser // Cast seguro pois selecionamos os campos necessários
                    );
                    
                    await dataService.addInspiration(inspirationDataPartial);
                    totalInspirationsProcessed++;
                    logger.info(`${TAG} User ${user._id}: Metric ${metric._id} processada e adicionada/atualizada como inspiração. Duração: ${Date.now() - metricProcessStartTime}ms`);

                } catch (metricError: any) {
                    totalErrorsProcessingMetrics++;
                    logger.error(`${TAG} User ${user._id}: Erro ao processar Metric ${metric._id}: ${metricError.message}`, metricError.stack);
                }
            }
            logger.info(`${TAG} User ${user._id}: Processamento concluído. ${metricsToProcess.length} métricas tentadas. Duração: ${Date.now() - userProcessStartTime}ms. Query=${JSON.stringify(debugQuery)} sinceDate=${debugSinceDate.toISOString()}`);

        } catch (userError: any) {
            logger.error(`${TAG} Erro ao processar posts para o usuário ${user._id}: ${userError.message}`, userError.stack);
            // Continua para o próximo usuário
        }
    }

    const overallDuration = Date.now() - overallStartTime;
    const summaryMessage = `Processamento CRON concluído. Usuários processados: ${optedInUsers.length}/${MAX_USERS_TO_PROCESS_PER_RUN}. Total Métricas Elegíveis Encontradas: ${totalEligibleMetricsFound}. Inspirações Processadas (Adicionadas/Atualizadas): ${totalInspirationsProcessed}. Erros no Processamento de Métricas: ${totalErrorsProcessingMetrics}. Duração Total: ${overallDuration}ms.`;
    logger.info(`${TAG} ${summaryMessage}`);
    
    return NextResponse.json({ 
        success: true, 
        message: summaryMessage,
        usersProcessed: optedInUsers.length,
        eligibleMetricsFound: totalEligibleMetricsFound,
        inspirationsProcessed: totalInspirationsProcessed,
        errorsProcessingMetrics: totalErrorsProcessingMetrics,
        durationMs: overallDuration
    }, { status: 200 });

  } catch (error: any) {
    const overallDuration = Date.now() - overallStartTime;
    logger.error(`${TAG} Erro GERAL não tratado no CRON de População de Inspirações. Duração até erro: ${overallDuration}ms:`, error);
    return NextResponse.json({ error: `Internal server error: ${error.message}` }, { status: 500 });
  }
}