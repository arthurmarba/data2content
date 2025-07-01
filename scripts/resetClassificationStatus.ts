/**
 * @fileoverview Script para resetar o status de classificação de posts.
 * @version 2.1.0 - Atualizado para resetar posts com status 'completed' OU 'failed'.
 * @description Este script busca todos os posts que já foram processados (com sucesso ou falha)
 * e reverte seu status para 'pending', permitindo que sejam reprocessados.
 *
 * @run `npm run reset-classification`
 */

import mongoose from 'mongoose';
import { connectToDatabase } from '@/app/lib/mongoose';
import Metric from '@/app/models/Metric';
import { logger } from '@/app/lib/logger';

const SCRIPT_TAG = '[SCRIPT_RESET_STATUS]';

async function resetAllClassificationStatus() {
  logger.info(`${SCRIPT_TAG} Iniciando script para resetar status de classificação...`);

  try {
    await connectToDatabase();
    logger.info(`${SCRIPT_TAG} Conexão com o banco de dados estabelecida.`);

    // ATUALIZAÇÃO: A busca agora inclui tanto 'completed' quanto 'failed',
    // garantindo que os posts que falharam por rate limit sejam incluídos.
    const metricsToReset = await Metric.find({
      classificationStatus: { $in: ['completed', 'failed'] }
    })
    .select('_id')
    .lean();

    if (metricsToReset.length === 0) {
      logger.info(`${SCRIPT_TAG} Nenhum post 'completed' ou 'failed' encontrado para resetar. Encerrando.`);
      return;
    }

    const metricIdsToReset = metricsToReset.map(metric => metric._id);
    logger.info(`${SCRIPT_TAG} ${metricIdsToReset.length} posts serão resetados para 'pending'.`);

    // Reseta o status e limpa os campos de classificação
    const updateResult = await Metric.updateMany(
      { _id: { $in: metricIdsToReset } },
      {
        $set: {
          classificationStatus: 'pending',
          classificationError: null,
          tone: [],
          references: []
        }
      }
    );

    logger.info(`${SCRIPT_TAG} Processo concluído. ${updateResult.modifiedCount} documentos foram atualizados.`);

  } catch (error) {
    logger.error(`${SCRIPT_TAG} Um erro crítico ocorreu durante a execução do script:`, error);
  } finally {
    await mongoose.disconnect();
    logger.info(`${SCRIPT_TAG} Conexão com o banco de dados encerrada.`);
  }
}

// Executa a função principal
resetAllClassificationStatus();
