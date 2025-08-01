/**
 * @fileoverview Serviço para calcular a eficácia do Radar Mobi.
 * @version 1.0.0
 */

import { PipelineStage } from 'mongoose';
import { subDays } from 'date-fns';
import { logger } from '@/app/lib/logger';
import UserModel from '@/app/models/User';
import { connectToDatabase } from '../connection';
import { DatabaseError } from '@/app/lib/errors';
import { IFetchTucaRadarEffectivenessArgs, ITucaRadarEffectivenessResult } from './types';

const SERVICE_TAG = '[dataService][radarService]';

/**
 * @function fetchTucaRadarEffectiveness
 * @description Calculates the effectiveness of Mobi Radar alerts based on user interactions.
 * @param {IFetchTucaRadarEffectivenessArgs} args - Arguments defining the alert type and period.
 * @returns {Promise<ITucaRadarEffectivenessResult[]>} - An array of effectiveness results.
 */
export async function fetchTucaRadarEffectiveness(args: IFetchTucaRadarEffectivenessArgs): Promise<ITucaRadarEffectivenessResult[]> {
    const TAG = `${SERVICE_TAG}[fetchTucaRadarEffectiveness]`;
    const { alertType, periodDays } = args;
    try {
        await connectToDatabase();
        const sinceDate = subDays(new Date(), periodDays);
        const positiveInteractionTypes = ['explored_further', 'clicked_suggestion', 'provided_feedback'];

        const matchStage: PipelineStage.Match['$match'] = {
            'alertHistory.date': { $gte: sinceDate }
        };
        if (alertType) {
            matchStage['alertHistory.type'] = alertType;
        }

        const aggregationPipeline: PipelineStage[] = [
            { $unwind: '$alertHistory' },
            { $match: matchStage },
            { 
                $group: {
                    _id: '$alertHistory.type',
                    totalAlerts: { $sum: 1 },
                    positiveInteractions: {
                        $sum: {
                            $cond: [{ $in: ['$alertHistory.userInteraction.type', positiveInteractionTypes] }, 1, 0]
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    alertType: '$_id',
                    totalAlerts: 1,
                    positiveInteractionRate: {
                        $cond: [{ $eq: ['$totalAlerts', 0] }, 0, { $divide: ['$positiveInteractions', '$totalAlerts'] }]
                    }
                }
            },
            { $sort: { positiveInteractionRate: -1 } }
        ];

        logger.info(`${TAG} Executando agregação para eficácia dos alertas.`);
        const results = await UserModel.aggregate(aggregationPipeline);
        return results;
    } catch (error: any) {
        logger.error(`${TAG} Erro ao calcular eficácia do Radar Mobi:`, error);
        throw new DatabaseError(`Falha ao buscar dados de eficácia dos alertas: ${error.message}`);
    }
}
