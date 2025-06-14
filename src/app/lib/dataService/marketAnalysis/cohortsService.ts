/**
 * @fileoverview Serviço para comparar coortes de usuários.
 * @version 1.0.0
 */

import { PipelineStage } from 'mongoose';
import { logger } from '@/app/lib/logger';
import UserModel from '@/app/models/User';
import { connectToDatabase } from '../connection';
import { DatabaseError } from '@/app/lib/errors';
import { IFetchCohortComparisonArgs, ICohortComparisonResult } from './types';

const SERVICE_TAG = '[dataService][cohortsService]';

/**
 * @function fetchCohortComparison
 * @description Compares the average performance of content metrics across different user cohorts.
 * @param {IFetchCohortComparisonArgs} args - Arguments defining the metric and cohorts to compare.
 * @returns {Promise<ICohortComparisonResult[]>} - An array of cohort comparison results.
 */
export async function fetchCohortComparison(args: IFetchCohortComparisonArgs): Promise<ICohortComparisonResult[]> {
    const TAG = `${SERVICE_TAG}[fetchCohortComparison]`;
    const { metric, cohorts } = args;
    try {
        await connectToDatabase();
        const metricPath = `stats.${metric}`;

        const facetPipelines: Record<string, PipelineStage.FacetPipelineStage[]> = {};
        for (const cohort of cohorts) {
            const cohortKey = `${cohort.filterBy}_${cohort.value}`.replace(/\s/g, '_');
            facetPipelines[cohortKey] = [
                { $match: { [cohort.filterBy]: cohort.value } },
                { $lookup: { from: 'metrics', localField: '_id', foreignField: 'user', as: 'metrics' } },
                { $unwind: '$metrics' },
                { $replaceRoot: { newRoot: '$metrics' } },
                { $match: { [metricPath]: { $exists: true, $ne: null } } },
                { 
                    $group: {
                        _id: null,
                        avgMetricValue: { $avg: `$${metricPath}` },
                        userCount: { $addToSet: '$user' }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        cohortName: { $concat: [cohort.filterBy, ": ", cohort.value] },
                        avgMetricValue: 1,
                        userCount: { $size: '$userCount' }
                    }
                }
            ];
        }

        const aggregationPipeline: PipelineStage[] = [{ $facet: facetPipelines }];
        
        logger.info(`${TAG} Executando agregação para comparação de coortes.`);
        const results = await UserModel.aggregate(aggregationPipeline);

        const flattenedResults = Object.values(results[0] || {}).flat();
        
        return (flattenedResults as ICohortComparisonResult[]).sort((a, b) => b.avgMetricValue - a.avgMetricValue);

    } catch (error: any) {
        logger.error(`${TAG} Erro ao comparar coortes:`, error);
        throw new DatabaseError(`Falha ao comparar coortes de usuários: ${error.message}`);
    }
}

/**
 * @function getAvailableContexts
 * @description Fetches a list of all available contexts from the metrics collection.
 * @returns {Promise<string[]>} A list of available contexts.
 */
export async function getAvailableContexts(): Promise<string[]> {
    const TAG = `${SERVICE_TAG}[getAvailableContexts]`;
    try {
        await connectToDatabase();
        // Presumindo que MetricModel está disponível ou será importado
        const MetricModel = (await import('@/app/models/Metric')).default;
        const contexts = await MetricModel.distinct('context');
        return contexts.filter((c): c is string => !!c);
    } catch (error: any) {
        logger.error(`${TAG} Erro ao buscar contextos:`, error);
        throw new DatabaseError(`Falha ao obter a lista de contextos: ${error.message}`);
    }
}
