import MetricModel, { IMetric } from '@/app/models/Metric';
import { connectToDatabase } from '@/app/lib/mongoose';
import { logger } from '@/app/lib/logger';
import { Types } from 'mongoose';
import { getNestedValue } from './dataAccessHelpers';
import { getStartDateFromTimePeriod } from './dateHelpers';
import { getCategoryById, getCategoryByValue } from '@/app/lib/classification';

export type GroupingType = 'format' | 'context' | 'proposal' | 'tone' | 'references';

interface AverageResult {
  name: string;
  value: number;
  postsCount: number;
}

async function getAverageEngagementByGrouping(
  userId: string | Types.ObjectId,
  timePeriod: string,
  performanceMetricField: string,
  groupBy: GroupingType,
  formatMapping?: Record<string, string>
): Promise<AverageResult[]> {
  const resolvedUserId =
    typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
  const today = new Date();
  const endDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    23, 59, 59, 999
  );
  const startDate = getStartDateFromTimePeriod(today, timePeriod);

  try {
    await connectToDatabase();

    const query: any = { user: resolvedUserId };
    if (timePeriod !== 'all_time') {
      query.postDate = { $gte: startDate, $lte: endDate };
    }

    const posts: IMetric[] = await MetricModel.find(query).lean();
    if (!posts.length) {
      return [];
    }

    const aggregation: Record<
      string,
      { sum: number; count: number; originalKey: string }
    > = {};

    const normalize = (value: string) =>
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

    const formatAliases: Record<string, string> = {
      photo: 'foto',
      imagem: 'foto',
      image: 'foto',
      carousel: 'carrossel',
      carrossel: 'carrossel',
      reel: 'reels',
      reels: 'reels',
      video: 'video',
      'video curto': 'reels',
      'shorts': 'reels',
    };

    const pushKey = (rawKey: string, value: number) => {
      if (!rawKey) return;

      // 1. Tentar encontrar a categoria oficial pelo ID ou pelo Rótulo
      // Se for algo como 'geography.city', tentamos extrair a parte relevante ou buscar diretamente
      let targetType: 'format' | 'proposal' | 'context' | 'tone' | 'reference' = 'format';
      if (groupBy === 'references') targetType = 'reference';
      else if (groupBy === 'proposal' || groupBy === 'context' || groupBy === 'tone' || groupBy === 'format') targetType = groupBy;

      const category = getCategoryById(rawKey, targetType) || getCategoryByValue(rawKey, targetType);

      // 2. Normalização para o nome de exibição (Canonical Label)
      let canonicalLabel = category ? category.label : rawKey;

      // 3. Fallback/Correção para casos específicos como 'geography.city' -> 'Geografia'
      const normalizedRaw = normalize(rawKey);
      if (!category) {
        if (normalizedRaw.includes('geography') || normalizedRaw.includes('geografia')) {
          canonicalLabel = 'Geografia';
        } else if (formatAliases[normalizedRaw]) {
          canonicalLabel = formatAliases[normalizedRaw];
          // Capitalizar formatAliases se necessário (opcional, mas bom por consistência)
          canonicalLabel = canonicalLabel.charAt(0).toUpperCase() + canonicalLabel.slice(1);
        }
      }

      // Se for 'city' ou 'country' puramente (ID técnico sem prefixo), e estivermos em 'references'
      if (groupBy === 'references' && (normalizedRaw === 'city' || normalizedRaw === 'country')) {
        canonicalLabel = 'Geografia';
      }

      // Garantir que a primeira letra seja maiúscula por padrão se não for categoria conhecida
      if (!category && canonicalLabel === rawKey) {
        canonicalLabel = canonicalLabel.charAt(0).toUpperCase() + canonicalLabel.slice(1);
      }

      const groupingKey = normalize(canonicalLabel);
      if (!groupingKey) return;

      const current = aggregation[groupingKey] || { sum: 0, count: 0, originalKey: canonicalLabel };
      current.sum += value;
      current.count += 1;
      aggregation[groupingKey] = current;
    };

    for (const post of posts) {
      const metricValue = getNestedValue(post, performanceMetricField);
      if (typeof metricValue !== 'number') continue;

      // CORREÇÃO: O erro 'Type 'string[]' cannot be used as an index type' ocorre porque as
      // propriedades de classificação (format, context, proposal) são arrays. A lógica foi
      // ajustada para iterar sobre cada item do array de classificação. Cada item (ex: 'Reel', 'Humor')
      // é então usado como uma chave para o objeto de agregação, resolvendo o erro de tipo.
      const keys = (post as any)?.[groupBy] as unknown;

      if (Array.isArray(keys)) {
        for (const key of keys) {
          pushKey(String(key), metricValue);
        }
      } else if (typeof keys === 'string') {
        const safeKey = keys.trim();
        if (safeKey) pushKey(safeKey, metricValue);
      }
    }

    const results: AverageResult[] = [];
    for (const [key, data] of Object.entries(aggregation)) {
      if (data.count === 0) continue;
      const displayKey = data.originalKey || key;
      const name =
        groupBy === 'format'
          ? formatMapping?.[displayKey] || displayKey
          : displayKey;
      results.push({
        name,
        value: data.sum / data.count,
        postsCount: data.count,
      });
    }

    results.sort((a, b) => b.value - a.value);
    return results;
  } catch (error) {
    logger.error(
      `Error in getAverageEngagementByGrouping for userId ${resolvedUserId}:`,
      error
    );
    return [];
  }
}

export default getAverageEngagementByGrouping;
