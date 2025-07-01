/**
 * @fileoverview Script para garantir que os índices corretos existam na coleção 'metrics'.
 * @version 1.0.1 - Corrigido erro de digitação na variável de log.
 * @description Este script se conecta ao banco de dados, remove quaisquer índices compostos
 * problemáticos que contenham múltiplos arrays e garante que os índices individuais
 * para os campos de classificação existam.
 *
 * @run `npm run ensure-indexes`
 */

import mongoose from 'mongoose';
import { connectToDatabase } from '@/app/lib/mongoose';
import Metric from '@/app/models/Metric';
import { logger } from '@/app/lib/logger';

const SCRIPT_TAG = '[SCRIPT_ENSURE_INDEXES]';

async function ensureCorrectIndexes() {
  logger.info(`${SCRIPT_TAG} Iniciando script para garantir os índices corretos...`);

  try {
    await connectToDatabase();
    const db = mongoose.connection;
    const metricsCollection = db.collection('metrics');
    logger.info(`${SCRIPT_TAG} Conexão com o banco de dados estabelecida.`);

    // 1. Listar todos os índices existentes na coleção
    const existingIndexes = await metricsCollection.listIndexes().toArray();
    logger.info(`${SCRIPT_TAG} Índices existentes:`, existingIndexes.map(idx => idx.name));

    // 2. Identificar e remover índices problemáticos
    const problematicIndexNames = [
        'idx_full_classification_filter', 
        'idx_topBottom_shares',
        'user_1_format_1_proposal_1_context_1_tone_1_references_1_postDate_-1', // Nome padrão do Mongoose
        'user_1_postDate_-1_stats.shares_-1' // Nome padrão do Mongoose
    ];

    for (const index of existingIndexes) {
        if (problematicIndexNames.includes(index.name)) {
            try {
                logger.warn(`${SCRIPT_TAG} Removendo índice problemático: ${index.name}`);
                await metricsCollection.dropIndex(index.name);
                // CORREÇÃO: Corrigido o erro de digitação de SCRIPT_TAD para SCRIPT_TAG.
                logger.info(`${SCRIPT_TAG} Índice ${index.name} removido com sucesso.`);
            } catch (dropError) {
                logger.error(`${SCRIPT_TAG} Falha ao remover o índice ${index.name}. Pode já ter sido removido. Erro:`, dropError);
            }
        }
    }

    // 3. Garantir que os índices individuais e seguros existam
    logger.info(`${SCRIPT_TAG} Garantindo a existência dos índices individuais corretos...`);
    await Metric.createIndexes();
    logger.info(`${SCRIPT_TAG} Processo de verificação de índices concluído.`);

  } catch (error) {
    logger.error(`${SCRIPT_TAG} Um erro crítico ocorreu durante a execução do script:`, error);
  } finally {
    await mongoose.disconnect();
    logger.info(`${SCRIPT_TAG} Conexão com o banco de dados encerrada.`);
  }
}

ensureCorrectIndexes();
