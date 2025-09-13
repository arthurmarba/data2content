import MetricModel, { IMetric } from "@/app/models/Metric"; // Ajuste o caminho conforme necessário
import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose"; // Added
import { logger } from "@/app/lib/logger"; // Added
import { getStartDateFromTimePeriod as getStartDateFromTimePeriodGeneric } from "./dateHelpers"; // Para fallback

interface AverageEngagementData {
  totalEngagement: number;
  numberOfPosts: number;
  averageEngagementPerPost: number;
  sumEngagementRateOnReach: number;
  averageEngagementRateOnReach: number;
  sumReach: number; // soma do alcance (stats.reach)
  sumViews: number; // soma de views (ou video_views)
  startDateUsed: Date | null; // Renomeado para clareza
  endDateUsed: Date | null;   // Renomeado para clareza
}

async function calculateAverageEngagementPerPost(
  userId: string | Types.ObjectId,
  periodInDaysOrConfig: number | { startDate: Date; endDate: Date }
): Promise<AverageEngagementData> {
  const resolvedUserId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

  let effectiveStartDate: Date;
  let effectiveEndDate: Date;

  if (typeof periodInDaysOrConfig === 'number') {
    const periodInDays = periodInDaysOrConfig;
    const today = new Date();
    effectiveEndDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    effectiveStartDate = getStartDateFromTimePeriodGeneric(today, `last_${periodInDays}_days`);
  } else {
    effectiveStartDate = new Date(periodInDaysOrConfig.startDate);
    effectiveEndDate = new Date(periodInDaysOrConfig.endDate);
    // Garantir que as horas sejam consistentes se vierem de fora
    effectiveStartDate.setHours(0,0,0,0);
    effectiveEndDate.setHours(23,59,59,999);
  }

  const initialResult: AverageEngagementData = {
    totalEngagement: 0,
    numberOfPosts: 0,
    averageEngagementPerPost: 0,
    sumEngagementRateOnReach: 0,
    averageEngagementRateOnReach: 0,
    sumReach: 0,
    sumViews: 0,
    startDateUsed: effectiveStartDate,
    endDateUsed: effectiveEndDate,
  };

  try {
    await connectToDatabase(); // Added

    const posts: IMetric[] = await MetricModel.find({
      user: resolvedUserId,
      postDate: { $gte: effectiveStartDate, $lte: effectiveEndDate },
    }).lean();

    if (!posts || posts.length === 0) {
      return initialResult;
    }

    let tempTotalInteractions = 0;
    let tempSumEngagementRateOnReach = 0;
    let tempSumReach = 0;
    let tempSumViews = 0;
    // Contagem de posts válidos para cada métrica específica não é usada no cálculo final da média
    // conforme a definição da tarefa, mas pode ser útil para entender os dados.
    // let validPostsForRate = 0;
    // let validPostsForInteractions = 0;

    for (const post of posts) {
      if (post.stats) {
        if (typeof post.stats.total_interactions === 'number') {
          tempTotalInteractions += post.stats.total_interactions;
          // validPostsForInteractions++;
        }
        if (typeof post.stats.engagement_rate_on_reach === 'number') {
          tempSumEngagementRateOnReach += post.stats.engagement_rate_on_reach;
          // validPostsForRate++;
        }
        if (typeof (post.stats as any).reach === 'number') {
          tempSumReach += (post.stats as any).reach as number;
        }
        const viewsFallback = (post.stats as any)?.views ?? (post.stats as any)?.video_views;
        if (typeof viewsFallback === 'number') {
          tempSumViews += viewsFallback as number;
        }
      }
    }

    initialResult.numberOfPosts = posts.length;
    initialResult.totalEngagement = tempTotalInteractions;
    initialResult.sumEngagementRateOnReach = tempSumEngagementRateOnReach;
    initialResult.sumReach = tempSumReach;
    initialResult.sumViews = tempSumViews;


    if (initialResult.numberOfPosts > 0) {
      initialResult.averageEngagementPerPost = tempTotalInteractions / initialResult.numberOfPosts;
      initialResult.averageEngagementRateOnReach = tempSumEngagementRateOnReach / initialResult.numberOfPosts;
    }

    return initialResult;

  } catch (error) {
    logger.error(`Error calculating average engagement for userId ${resolvedUserId} between ${effectiveStartDate.toISOString()} and ${effectiveEndDate.toISOString()}:`, error); // Replaced console.error
    // Retorna o resultado inicial com datas usadas, mas métricas zeradas
    return {
      ...initialResult, // Mantém startDateUsed e endDateUsed
      totalEngagement: 0,
      numberOfPosts: 0,
      averageEngagementPerPost: 0,
      sumEngagementRateOnReach: 0,
      averageEngagementRateOnReach: 0,
      sumReach: 0,
      sumViews: 0,
    };
  }
}

export default calculateAverageEngagementPerPost;
