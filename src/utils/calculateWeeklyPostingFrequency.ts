import MetricModel, { IMetric } from "@/app/models/Metric"; // Ajuste o caminho conforme necessário
import { Types } from "mongoose";

interface WeeklyPostingFrequencyData {
  currentWeeklyFrequency: number;
  postsInCurrentPeriod: number;
  previousWeeklyFrequency: number;
  postsInPreviousPeriod: number;
  deltaInWeeklyFrequency: number;
  currentPeriodStartDate?: Date;
  currentPeriodEndDate?: Date;
  previousPeriodStartDate?: Date;
  previousPeriodEndDate?: Date;
}

async function calculateWeeklyPostingFrequency(
  userId: string | Types.ObjectId,
  periodInDays: number // Ex: 30 dias para o período atual e o anterior
): Promise<WeeklyPostingFrequencyData> {
  const resolvedUserId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

  if (periodInDays <= 0) {
    console.warn(`periodInDays must be greater than 0. Received: ${periodInDays}`);
    // Retornar valores padrão ou lançar um erro, conforme política
    const now = new Date();
    return {
      currentWeeklyFrequency: 0,
      postsInCurrentPeriod: 0,
      previousWeeklyFrequency: 0,
      postsInPreviousPeriod: 0,
      deltaInWeeklyFrequency: 0,
      currentPeriodStartDate: now,
      currentPeriodEndDate: now,
      previousPeriodStartDate: now,
      previousPeriodEndDate: now,
    };
  }

  // 1. Período Atual
  const currentPeriodEndDate = new Date();
  const currentPeriodStartDate = new Date();
  currentPeriodStartDate.setDate(currentPeriodEndDate.getDate() - periodInDays);

  // 2. Período Anterior
  // O endDate do período anterior é o dia *antes* do startDate do período atual.
  const previousPeriodEndDate = new Date(currentPeriodStartDate);
  previousPeriodEndDate.setDate(previousPeriodEndDate.getDate() - 1); // Garante que não há sobreposição

  const previousPeriodStartDate = new Date(previousPeriodEndDate);
  previousPeriodStartDate.setDate(previousPeriodEndDate.getDate() - (periodInDays -1)); // - (periodInDays-1) porque o previousPeriodEndDate já é um dia

  const initialResult: WeeklyPostingFrequencyData = {
    currentWeeklyFrequency: 0,
    postsInCurrentPeriod: 0,
    previousWeeklyFrequency: 0,
    postsInPreviousPeriod: 0,
    deltaInWeeklyFrequency: 0,
    currentPeriodStartDate: currentPeriodStartDate,
    currentPeriodEndDate: currentPeriodEndDate,
    previousPeriodStartDate: previousPeriodStartDate,
    previousPeriodEndDate: previousPeriodEndDate,
  };

  try {
    // Contar posts no período atual
    const postsInCurrentPeriod = await MetricModel.countDocuments({
      user: resolvedUserId,
      postDate: { $gte: currentPeriodStartDate, $lte: currentPeriodEndDate },
    });
    initialResult.postsInCurrentPeriod = postsInCurrentPeriod;
    initialResult.currentWeeklyFrequency = (postsInCurrentPeriod / periodInDays) * 7;

    // Contar posts no período anterior
    // Nota: A lógica original da task era:
    // endDatePreviousPeriod = startDateCurrentPeriod
    // startDatePreviousPeriod = new Date(new Date().setDate(endDatePreviousPeriod.getDate() - periodInDays))
    // E a query: Metric.countDocuments({ user: userId, postDate: { $gte: startDatePreviousPeriod, $lt: endDatePreviousPeriod } })
    // A implementação atual com previousPeriodEndDate.setDate(previousPeriodEndDate.getDate() - 1);
    // e previousPeriodStartDate.setDate(previousPeriodEndDate.getDate() - (periodInDays -1));
    // e a query $gte: previousPeriodStartDate, $lte: previousPeriodEndDate é equivalente e talvez mais clara.
    // Vamos manter a query com $lte para previousPeriodEndDate, pois as datas são calculadas para serem inclusivas.
    const postsInPreviousPeriod = await MetricModel.countDocuments({
      user: resolvedUserId,
      postDate: { $gte: previousPeriodStartDate, $lte: previousPeriodEndDate },
    });
    initialResult.postsInPreviousPeriod = postsInPreviousPeriod;
    initialResult.previousWeeklyFrequency = (postsInPreviousPeriod / periodInDays) * 7;

    initialResult.deltaInWeeklyFrequency = initialResult.currentWeeklyFrequency - initialResult.previousWeeklyFrequency;

    return initialResult;

  } catch (error) {
    console.error(`Error calculating weekly posting frequency for userId ${resolvedUserId}:`, error);
    // Retorna o objeto com valores padrão em caso de erro, mas com as datas preenchidas
    return {
        currentWeeklyFrequency: 0,
        postsInCurrentPeriod: 0,
        previousWeeklyFrequency: 0,
        postsInPreviousPeriod: 0,
        deltaInWeeklyFrequency: 0,
        currentPeriodStartDate: currentPeriodStartDate,
        currentPeriodEndDate: currentPeriodEndDate,
        previousPeriodStartDate: previousPeriodStartDate,
        previousPeriodEndDate: previousPeriodEndDate,
    };
  }
}

export default calculateWeeklyPostingFrequency;
