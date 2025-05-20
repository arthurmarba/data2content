/**
 * @fileoverview Serviço para operações relacionadas a AdDeals (negócios de publicidade) no dataService.
 * @version 2.14.4
 */
import mongoose, { Types } from 'mongoose';
import { subDays } from 'date-fns';

// Logger e Erros
import { logger } from '@/app/lib/logger'; // Ajuste o caminho se necessário
import { DatabaseError } from '@/app/lib/errors'; // Ajuste o caminho se necessário

// Modelo Mongoose
// Ajuste o caminho para o seu modelo AdDeal.
import AdDeal from '@/app/models/AdDeal';

// Conexão com o banco de dados e tipos locais
import { connectToDatabase } from './connection';
import { AdDealInsights } from './types'; // Importa a interface AdDealInsights

/**
 * Calcula e retorna insights sobre os negócios de publicidade (AdDeals) de um utilizador
 * para um determinado período.
 * @param userId - O ID do utilizador.
 * @param period - O período para análise ('last30d', 'last90d', 'all'). Padrão é 'last90d'.
 * @returns Uma promessa que resolve para um objeto AdDealInsights ou null se não houver deals.
 * @throws {DatabaseError} Se o ID do utilizador for inválido ou ocorrer um erro de banco de dados.
 */
export async function getAdDealInsights(
    userId: string,
    period: 'last30d' | 'last90d' | 'all' = 'last90d'
): Promise<AdDealInsights | null> {
    const TAG = '[dataService][adDealService][getAdDealInsights]'; // Tag de log atualizada
    logger.debug(`${TAG} Calculando insights de AdDeals para User ${userId}, período: ${period}`);

    if (!mongoose.isValidObjectId(userId)) {
        logger.error(`${TAG} ID de utilizador inválido: ${userId}`);
        throw new DatabaseError(`ID de utilizador inválido: ${userId}`);
    }

    const userIdObj = new Types.ObjectId(userId);
    let dateFilter: any = {};
    const now = new Date();

    // Define o filtro de data com base no período
    if (period === 'last30d') {
        dateFilter = { $gte: subDays(now, 30) };
    } else if (period === 'last90d') {
        dateFilter = { $gte: subDays(now, 90) };
    }
    // Se 'all', dateFilter permanece vazio, não filtrando por data.

    try {
        await connectToDatabase(); // Garante conexão

        // Query base para AdDeals do utilizador
        const baseQuery: any = { userId: userIdObj };
        if (Object.keys(dateFilter).length > 0) {
            baseQuery.dealDate = dateFilter; // Adiciona filtro de data se aplicável
        }

        // Conta o total de deals no período
        const totalDeals = await AdDeal.countDocuments(baseQuery);
        logger.debug(`${TAG} Total de deals no período '${period}' para User ${userId}: ${totalDeals}`);

        if (totalDeals === 0) {
            logger.info(`${TAG} Nenhum AdDeal encontrado para User ${userId} no período ${period}.`);
            return null; // Retorna null se não houver deals
        }

        // Executa várias agregações em paralelo para calcular os insights
        const [
            revenueStats,      // Estatísticas de receita
            segmentStats,      // Segmentos de marca mais comuns
            compensationStats, // Valor médio por tipo de compensação
            deliverableStats,  // Entregáveis mais comuns
            platformStats,     // Plataformas mais comuns
            frequencyStats     // Para calcular a frequência de deals
        ] = await Promise.all([
            // Receita total (apenas para deals com valor fixo ou misto em BRL)
            AdDeal.aggregate([
                { $match: { ...baseQuery, compensationType: { $in: ['Valor Fixo', 'Misto'] }, compensationCurrency: 'BRL' } },
                { $group: { _id: null, totalRevenueBRL: { $sum: '$compensationValue' }, countPaid: { $sum: 1 } } }
            ]),
            // Segmentos de marca mais comuns (top 3)
            AdDeal.aggregate([
                { $match: { ...baseQuery, brandSegment: { $nin: [null, ""] } } }, // Exclui nulos ou vazios
                { $group: { _id: '$brandSegment', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 3 }
            ]),
            // Valor médio por tipo de compensação (para deals em BRL)
            AdDeal.aggregate([
                { $match: { ...baseQuery, compensationValue: { $ne: null }, compensationCurrency: 'BRL' } },
                { $group: { _id: '$compensationType', avgValueBRL: { $avg: '$compensationValue' }, count: { $sum: 1 } } }
            ]),
            // Entregáveis mais comuns (top 5)
            AdDeal.aggregate([
                { $match: { ...baseQuery, deliverables: { $ne: null, $exists: true } } }, // Garante que deliverables existe e não é nulo
                { $unwind: '$deliverables' }, // Transforma o array de deliverables em documentos separados
                { $match: { deliverables: { $nin: [null, ""] } } }, // Exclui nulos ou vazios após unwind
                { $group: { _id: '$deliverables', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 5 }
            ]),
            // Plataformas mais comuns (top 3)
            AdDeal.aggregate([
                { $match: { ...baseQuery, platform: { $nin: [null, ""] } } },
                { $group: { _id: '$platform', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 3 }
            ]),
            // Para calcular a frequência: primeira e última data de deal, e total de deals
            AdDeal.aggregate([
                { $match: baseQuery },
                { $group: { _id: null, firstDealDate: { $min: "$dealDate" }, lastDealDate: { $max: "$dealDate" }, totalDealsAgg: { $sum: 1 } } }, // totalDealsAgg para não conflitar com a variável totalDeals
                { $project: {
                    _id: 0,
                    totalDealsAgg: 1,
                    // Calcula a diferença em dias. Garante que seja no mínimo 1 para evitar divisão por zero.
                    periodInDays: { $max: [ { $divide: [ { $subtract: ["$lastDealDate", "$firstDealDate"] }, 1000 * 60 * 60 * 24 ] }, 1 ] }
                  }
                }
            ])
       ]);

       // Processa os resultados das agregações
       const revenueResult = revenueStats[0] || { totalRevenueBRL: 0, countPaid: 0 };
       const avgDealValueBRL = revenueResult.countPaid > 0 ? revenueResult.totalRevenueBRL / revenueResult.countPaid : undefined;

       const commonBrandSegments = segmentStats.map(s => s._id).filter(s => s); // Filtra nulos se houver

       const avgValueByCompensation = compensationStats.reduce((acc, curr) => {
           if (curr._id) { // Garante que _id (compensationType) existe
               acc[curr._id] = curr.avgValueBRL;
           }
           return acc;
       }, {} as { [key: string]: number });

       const commonDeliverables = deliverableStats.map(d => d._id).filter(d => d);
       const commonPlatforms = platformStats.map(p => p._id).filter(p => p);

       let dealsFrequency: number | undefined = undefined;
       if (frequencyStats.length > 0 && frequencyStats[0].periodInDays >= 1 && frequencyStats[0].totalDealsAgg > 1) {
           const days = frequencyStats[0].periodInDays;
           const dealsInPeriod = frequencyStats[0].totalDealsAgg;
           // Calcula a frequência média de deals por mês (aproximadamente 30.44 dias/mês)
           dealsFrequency = (dealsInPeriod / days) * 30.44;
       }

       const insights: AdDealInsights = {
           period,
           totalDeals,
           totalRevenueBRL: revenueResult.totalRevenueBRL ?? 0,
           averageDealValueBRL: avgDealValueBRL,
           commonBrandSegments,
           avgValueByCompensation,
           commonDeliverables,
           commonPlatforms,
           dealsFrequency
       };

       logger.info(`${TAG} Insights de AdDeals calculados com sucesso para User ${userId}.`);
       return insights;

    } catch (error: any) {
        logger.error(`${TAG} Erro ao calcular insights de AdDeals para User ${userId}:`, error);
        throw new DatabaseError(`Erro ao calcular insights de publicidade: ${error.message}`);
    }
}
