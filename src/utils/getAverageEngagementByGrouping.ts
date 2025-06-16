import MetricModel, { IMetric, FormatType } from "@/app/models/Metric"; // Ajuste o caminho
import { Types } from "mongoose";
import { getNestedValue } from "./dataAccessHelpers";
import { getStartDateFromTimePeriod } from "./dateHelpers";

export type GroupingType = "format" | "context";

export interface AverageEngagementByGroupingData {
  name: string; // Nome do formato ou contexto
  value: number; // Média da métrica de performance
  postsCount: number; // Número de posts nesse grupo
}

// Mapeamento de formato para nome amigável (opcional, pode ser passado ou definido globalmente)
const DEFAULT_FORMAT_MAPPING: { [key: string]: string } = {
  [FormatType.IMAGE]: "Imagem",
  [FormatType.VIDEO]: "Vídeo",
  [FormatType.REEL]: "Reel",
  [FormatType.CAROUSEL_ALBUM]: "Carrossel",
  // Adicionar outros formatos conforme necessário
};


async function getAverageEngagementByGrouping(
  userId: string | Types.ObjectId,
  timePeriod: string,
  performanceMetricField: string, // Ex: "stats.total_interactions"
  groupBy: GroupingType,
  formatMapping?: { [key: string]: string } // Opcional, para nomes amigáveis de formato
): Promise<AverageEngagementByGroupingData[]> {
  const resolvedUserId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

  const today = new Date();
  const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  const startDate = getStartDateFromTimePeriod(today, timePeriod);

  const results: AverageEngagementByGroupingData[] = [];

  try {
    const queryConditions: any = { user: resolvedUserId };
    if (timePeriod !== "all_time") {
      queryConditions.postDate = { $gte: startDate, $lte: endDate };
    }

    const posts: IMetric[] = await MetricModel.find(queryConditions).lean();

    if (!posts || posts.length === 0) {
      return results; // Retorna array vazio se não houver posts
    }

    const performanceByGroup: {
      [key: string]: { sumPerformance: number; count: number };
    } = {};

    for (const post of posts) {
      let groupKey: string | undefined | null = null;

      if (groupBy === "format") {
        groupKey = post.format as string;
      } else if (groupBy === "context") {
        groupKey = post.context; // Assumindo que context é uma string ou pode ser convertida
      }

      const performanceValue = getNestedValue(post, performanceMetricField);

      if (groupKey && performanceValue !== null) {
        const keyString = groupKey.toString();
        if (!performanceByGroup[keyString]) {
          performanceByGroup[keyString] = { sumPerformance: 0, count: 0 };
        }
        performanceByGroup[keyString].sumPerformance += performanceValue;
        performanceByGroup[keyString].count += 1;
      }
    }

    if (Object.keys(performanceByGroup).length === 0) {
      return results; // Nenhum grupo com dados de performance válidos
    }

    for (const key in performanceByGroup) {
      const data = performanceByGroup[key];
      if (data.count > 0) {
        let displayName = key;
        if (groupBy === "format") {
            const mappingToUse = formatMapping || DEFAULT_FORMAT_MAPPING;
            displayName = mappingToUse[key] || key.toString().replace(/_/g, ' ').toLocaleLowerCase().replace(/\b\w/g, l => l.toUpperCase());
        }
        // Para 'context', o 'key' já é o nome do contexto. Poderia ter um mapping similar se necessário.

        results.push({
          name: displayName,
          value: data.sumPerformance / data.count, // Média
          postsCount: data.count,
        });
      }
    }

    // Ordenar por valor descendente para o gráfico
    results.sort((a, b) => b.value - a.value);

    return results;

  } catch (error) {
    console.error(`Error in getAverageEngagementByGrouping for userId ${resolvedUserId}, groupBy ${groupBy}:`, error);
    return []; // Retorna array vazio em caso de erro
  }
}

export default getAverageEngagementByGrouping;
```
