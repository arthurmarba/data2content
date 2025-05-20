/**
 * @fileoverview Serviço para operações relacionadas a AccountInsights no dataService.
 * @version 2.14.5 (Adiciona getAccountInsightHistory)
 */
import mongoose, { Types } from 'mongoose';
import { subDays } from 'date-fns'; // Importar subDays

// Logger e Erros
import { logger } from '@/app/lib/logger'; // Ajuste o caminho se necessário
import { DatabaseError } from '@/app/lib/errors'; // Ajuste o caminho se necessário

// Modelo Mongoose
// Ajuste o caminho para o seu modelo AccountInsight.
import AccountInsightModel, { IAccountInsight } from '@/app/models/AccountInsight';

// Conexão com o banco de dados
import { connectToDatabase } from './connection';

/**
 * Busca os insights de conta mais recentes para um utilizador.
 * @param userId - O ID do utilizador.
 * @returns Uma promessa que resolve para o objeto IAccountInsight mais recente ou null se não encontrado.
 * @throws {DatabaseError} Se ocorrer um erro de banco de dados.
 */
export async function getLatestAccountInsights(userId: string): Promise<IAccountInsight | null> {
    const TAG = '[dataService][accountInsightService][getLatestAccountInsights]';
    logger.debug(`${TAG} Buscando últimos insights da conta para utilizador ${userId}`);

    if (!mongoose.isValidObjectId(userId)) {
        logger.error(`${TAG} ID de utilizador inválido fornecido: ${userId}. Retornando null.`);
        return null;
    }

    try {
        await connectToDatabase();
        const latestInsight = await AccountInsightModel.findOne({
            user: new Types.ObjectId(userId)
        })
        .sort({ recordedAt: -1 })
        .lean<IAccountInsight>(); // Especificar o tipo para .lean()

        if (!latestInsight) {
            logger.info(`${TAG} Nenhum AccountInsight encontrado para o utilizador ${userId}.`);
            return null;
        }

        logger.info(`${TAG} Último AccountInsight encontrado para ${userId}, registado em: ${latestInsight.recordedAt}.`);
        return latestInsight; // O cast não é mais necessário devido ao <IAccountInsight> no lean()
    } catch (error: any) {
        logger.error(`${TAG} Erro de banco de dados ao buscar AccountInsight para ${userId}:`, error);
        throw new DatabaseError(`Erro ao buscar insights da conta: ${error.message}`);
    }
}

/**
 * Busca o histórico de insights de conta para um utilizador dentro de um período de lookback.
 * @param userId - O ID do utilizador.
 * @param lookbackDays - O número de dias para retroceder na busca.
 * @returns Uma promessa que resolve para um array de objetos IAccountInsight, ordenados do mais antigo para o mais recente.
 * @throws {DatabaseError} Se ocorrer um erro de banco de dados.
 */
export async function getAccountInsightHistory(
    userId: string,
    lookbackDays: number
): Promise<IAccountInsight[]> {
    const TAG = '[dataService][accountInsightService][getAccountInsightHistory]';
    logger.debug(`${TAG} Buscando histórico de insights da conta para utilizador ${userId} nos últimos ${lookbackDays} dias.`);

    if (!mongoose.isValidObjectId(userId)) {
        logger.error(`${TAG} ID de utilizador inválido fornecido: ${userId}. Retornando array vazio.`);
        // Pode-se optar por lançar um erro ou retornar vazio dependendo da política de erro.
        // throw new DatabaseError(`ID de utilizador inválido: ${userId}`);
        return [];
    }

    if (typeof lookbackDays !== 'number' || lookbackDays <= 0) {
        logger.error(`${TAG} lookbackDays inválido: ${lookbackDays}. Deve ser um número positivo. Retornando array vazio.`);
        return [];
    }

    try {
        await connectToDatabase();
        const sinceDate = subDays(new Date(), lookbackDays);

        const insightsHistory = await AccountInsightModel.find({
            user: new Types.ObjectId(userId),
            recordedAt: { $gte: sinceDate } // Busca insights desde a data calculada
        })
        .sort({ recordedAt: 1 }) // Ordena do mais antigo para o mais recente no período
        .lean<IAccountInsight[]>(); // Especificar o tipo para .lean()

        if (!insightsHistory || insightsHistory.length === 0) {
            logger.info(`${TAG} Nenhum AccountInsight encontrado no histórico dos últimos ${lookbackDays} dias para o utilizador ${userId}.`);
            return [];
        }

        logger.info(`${TAG} Encontrados ${insightsHistory.length} registros de AccountInsight no histórico para ${userId}.`);
        return insightsHistory;
    } catch (error: any) {
        logger.error(`${TAG} Erro de banco de dados ao buscar histórico de AccountInsight para ${userId}:`, error);
        throw new DatabaseError(`Erro ao buscar histórico de insights da conta: ${error.message}`);
    }
}
