import MetricModel, { IMetric } from "@/app/models/Metric"; // Ajuste o caminho
import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose"; // Added
import { logger } from "@/app/lib/logger"; // Added
import { getStartDateFromTimePeriod } from "./dateHelpers"; // Added

interface AverageFollowerConversionRatePerPostData {
  averageFollowerConversionRatePerPost: number; // Em percentual, ex: 2.5 para 2.5%
  numberOfPostsConsideredForRate: number;
  sumFollowerConversionRate: number; // Soma das taxas (decimais)
  startDate?: Date | null;
  endDate?: Date | null;
}

async function calculateAverageFollowerConversionRatePerPost(
  userId: string | Types.ObjectId,
  periodInDays: number
): Promise<AverageFollowerConversionRatePerPostData> {
  const resolvedUserId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
  const today = new Date();
  // endDate for query should be end of today
  const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  // startDate for query should be start of the first day of the period
  const startDate = getStartDateFromTimePeriod(today, `last_${periodInDays}_days`); // Standardized

  const initialResult: AverageFollowerConversionRatePerPostData = {
    averageFollowerConversionRatePerPost: 0.0,
    numberOfPostsConsideredForRate: 0,
    sumFollowerConversionRate: 0.0,
    startDate: startDate,
    endDate: endDate,
  };

  try {
    await connectToDatabase(); // Added

    const posts: IMetric[] = await MetricModel.find({
      user: resolvedUserId,
      postDate: { $gte: startDate, $lte: endDate },
    }).lean();

    if (!posts || posts.length === 0) {
      return initialResult;
    }

    let tempSumFollowerConversionRate = 0.0;
    let tempNumberOfPostsConsidered = 0;

    for (const post of posts) {
      if (post.stats && typeof post.stats.follower_conversion_rate === 'number') {
        tempSumFollowerConversionRate += post.stats.follower_conversion_rate;
        tempNumberOfPostsConsidered++;
      }
    }

    initialResult.sumFollowerConversionRate = tempSumFollowerConversionRate;
    initialResult.numberOfPostsConsideredForRate = tempNumberOfPostsConsidered;

    if (initialResult.numberOfPostsConsideredForRate > 0) {
      // A task original (Ponto 1.c e 1.e) para "Taxa de Conversão Média por Post":
      // "Calcular a média de follower_conversion_rate entre todos os posts encontrados."
      // "A saída para esta parte deve ser averageFollowerConversionRatePerPost e numberOfPostsConsideredForRate."
      // A lógica de preparação de dados (Ponto 1.d) para esta métrica também dizia:
      // averageFollowerConversionRatePerPost = (sumFollowerConversionRate / numberOfPostsConsideredForRate) * 100
      // (se follower_conversion_rate nos posts é decimal, ex: 0.02)
      // Isto significa que a média é calculada apenas sobre os posts que *têm* a taxa.
      initialResult.averageFollowerConversionRatePerPost =
        (tempSumFollowerConversionRate / initialResult.numberOfPostsConsideredForRate) * 100;
    }

    return initialResult;

  } catch (error) {
    logger.error(`Error calculating average follower conversion rate per post for userId ${resolvedUserId}, period ${periodInDays} days:`, error); // Replaced console.error
    return {
      averageFollowerConversionRatePerPost: 0.0,
      numberOfPostsConsideredForRate: 0,
      sumFollowerConversionRate: 0.0,
      startDate: startDate,
      endDate: endDate,
    };
  }
}

export default calculateAverageFollowerConversionRatePerPost;

