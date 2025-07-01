/**
 * @fileoverview Script para forçar a limpeza de todos os índices compostos inválidos.
 * @version 1.0.0
 * @description Este script varre todos os índices da coleção 'metrics' e remove
 * qualquer um que seja composto e contenha mais de um campo de array, resolvendo
 * em definitivo o erro 'cannot index parallel arrays'.
 *
 * @run `npm run force-clean-indexes`
 */

import mongoose from 'mongoose';
import { connectToDatabase } from '@/app/lib/mongoose';
import { logger } from '@/app/lib/logger';

const SCRIPT_TAG = '[SCRIPT_FORCE_CLEAN_INDEXES]';

async function forceCleanIndexes() {
  logger.info(`${SCRIPT_TAG} Iniciando script para limpeza forçada de índices...`);

  try {
    await connectToDatabase();
    const db = mongoose.connection;
    const metricsCollection = db.collection('metrics');
    logger.info(`${SCRIPT_TAG} Conexão com o banco de dados estabelecida.`);

    const existingIndexes = await metricsCollection.listIndexes().toArray();
    logger.info(`${SCRIPT_TAG} Verificando ${existingIndexes.length} índices existentes...`);

    let droppedCount = 0;

    for (const index of existingIndexes) {
      const keys = Object.keys(index.key);
      // Um índice é problemático se tiver mais de uma chave e se pelo menos
      // duas dessas chaves forem campos que definimos como arrays no schema.
      const arrayFieldsInIndex = keys.filter(key => 
        ['format', 'proposal', 'context', 'tone', 'references'].includes(key)
      );

      if (arrayFieldsInIndex.length > 1) {
        try {
          logger.warn(`${SCRIPT_TAG} Índice problemático encontrado: ${index.name}. Contém múltiplos arrays: ${arrayFieldsInIndex.join(', ')}. Removendo...`);
          await metricsCollection.dropIndex(index.name);
          logger.info(`${SCRIPT_TAG} Índice ${index.name} removido com sucesso.`);
          droppedCount++;
        } catch (dropError) {
          logger.error(`${SCRIPT_TAG} Falha ao remover o índice ${index.name}. Erro:`, dropError);
        }
      }
    }

    if (droppedCount > 0) {
        logger.info(`${SCRIPT_TAG} Limpeza concluída. ${droppedCount} índices problemáticos foram removidos.`);
    } else {
        logger.info(`${SCRIPT_TAG} Nenhum índice problemático encontrado. O banco de dados parece estar limpo.`);
    }

  } catch (error) {
    logger.error(`${SCRIPT_TAG} Um erro crítico ocorreu durante a execução do script:`, error);
  } finally {
    await mongoose.disconnect();
    logger.info(`${SCRIPT_TAG} Conexão com o banco de dados encerrada.`);
  }
}

forceCleanIndexes();
