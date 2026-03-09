/**
 * @fileoverview Adapter de conexão do dataService.
 * Reutiliza o helper global de Mongoose para evitar dois gerenciadores
 * de conexão competindo no mesmo runtime.
 * @version 2.15.0
 */
import mongoose, { ConnectionStates } from 'mongoose';

import { logger } from '@/app/lib/logger';
import { connectToDatabase as connectSharedMongoose } from '@/app/lib/mongoose';

const EXPECTED_DB_NAME = process.env.MONGODB_DB_NAME || process.env.DB_NAME || 'data2content';

export const connectToDatabase = async (): Promise<typeof mongoose> => {
  const TAG = '[dataService][connection][connectToDatabase v2.15.0]';
  const currentReadyState = mongoose.connection.readyState;

  logger.info(
    `${TAG} Solicitada conexão. Estado Mongoose: ${ConnectionStates[currentReadyState]} (${currentReadyState}). Conexão atual: ${mongoose.connection.name || 'N/A'}. DB esperado: ${EXPECTED_DB_NAME}`
  );

  const mongooseInstance = await connectSharedMongoose();
  const connectedDbName = mongooseInstance.connection.name || 'N/A';

  if (connectedDbName !== EXPECTED_DB_NAME) {
    logger.warn(
      `${TAG} Conectado ao DB '${connectedDbName}', mas o dataService esperava '${EXPECTED_DB_NAME}'. Verifique MONGODB_DB_NAME/DB_NAME.`
    );
  } else {
    logger.info(`${TAG} Conexão reutilizada com sucesso para o DB '${connectedDbName}'.`);
  }

  return mongooseInstance;
};
