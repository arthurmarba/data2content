/**
 * @fileoverview Serviço para operações de demografia de audiência.
 * @version 1.0.0
 */
import mongoose, { Types } from 'mongoose';
import { logger } from '@/app/lib/logger';
import { DatabaseError } from '@/app/lib/errors';
import AudienceDemographicSnapshotModel, { IAudienceDemographics } from '@/app/models/demographics/AudienceDemographicSnapshot';
import { connectToDatabase } from './connection';

/**
 * Busca o snapshot demográfico mais recente de um usuário.
 * @param userId - ID do usuário.
 * @returns Objeto de demografia ou null se não encontrado.
 * @throws {DatabaseError} Em caso de erro de banco de dados.
 */
export async function getLatestAudienceDemographics(userId: string): Promise<IAudienceDemographics | null> {
  const TAG = '[dataService][demographicService][getLatestAudienceDemographics]';
  logger.debug(`${TAG} Buscando snapshot demográfico mais recente para ${userId}`);

  if (!mongoose.isValidObjectId(userId)) {
    logger.error(`${TAG} ID de usuário inválido: ${userId}`);
    return null;
  }

  try {
    await connectToDatabase();
    const snap = await AudienceDemographicSnapshotModel.findOne({ user: new Types.ObjectId(userId) })
      .sort({ recordedAt: -1 })
      .lean();

    if (!snap) {
      logger.info(`${TAG} Nenhum snapshot demográfico encontrado para ${userId}`);
      return null;
    }

    logger.info(`${TAG} Snapshot demográfico encontrado para ${userId} registrado em ${snap.recordedAt}`);
    return snap.demographics;
  } catch (err: any) {
    logger.error(`${TAG} Erro ao buscar demografia para ${userId}:`, err);
    throw new DatabaseError(`Erro ao buscar dados demográficos: ${err.message}`);
  }
}
