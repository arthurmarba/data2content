import { DailyMetric, IDailyMetric } from "@/app/models/DailyMetric";
import { Types, Model, models } from "mongoose"; // Importar Types, Model e models
import { formatISO } from 'date-fns';
import { logger } from '@/app/lib/logger'; // <-- VERIFIQUE SE ESTE CAMINHO ESTÁ CORRETO
import { IMetric } from "@/app/models/Metric"; // Import IMetric
// Importar MetricModel para usar em getDetailedContentStats dentro de buildAggregatedReport
import { Metric } from "@/app/models/Metric"; // Importa o modelo Metric exportado

// **** Interface OverallStats ****
export interface OverallStats {
  _id: null;
  totalCurtidas: number;
  totalComentarios: number;
  totalCompartilhamentos: number;
  totalVisualizacoes: number;
  totalSalvamentos: number;
  avgCurtidas: number;
  avgComentarios: number;
  avgCompartilhamentos: number;
  avgVisualizacoes: number;
  avgSalvamentos: number;
  count: number;
}

// **** Interface DayOfWeekStat ****
export interface DayOfWeekStat {
  dayName: string;
  averageShares: number; // Focado em compartilhamentos aqui
  totalPosts: number;
}

// **** Interface DurationStat ****
export interface DurationStat {
  range: string;
  contentCount: number;
  averageShares: number; // Focado em compartilhamentos aqui
}

// **** <<< ATUALIZADO v3.2 >>> Interface para Stats Detalhados ****
export interface DetailedContentStat {
  _id: {
    format: string;   // Formato do conteúdo (ex: Reel, Foto)
    proposal: string; // Propósito do conteúdo (ex: Dicas, Lifestyle)
    context: string;  // Contexto/Nicho (ex: Fitness, Viagem)
  };
  avgCompartilhamentos: number;
  avgSalvamentos: number;
  avgCurtidas?: number; // Média de curtidas (opcional, mas útil)
  count: number;       // Número de posts nesse agrupamento
  // Poderia adicionar outras médias aqui (ex: avgVisualizacoes)
}


// **** <<< ATUALIZADO v3.2 >>> Interface AggregatedReport ****
//     (Adiciona campo para as estatísticas detalhadas)
export interface AggregatedReport {
  top3: IDailyMetric[];
  bottom3: IDailyMetric[];
  dayOfWeekStats: DayOfWeekStat[];
  durationStats: DurationStat[];
  detailedContentStats: DetailedContentStat[]; // <<< NOVO CAMPO >>>
  overallStats?: OverallStats;
}

// **** <<< ATUALIZADO v3.2 >>> Função buildAggregatedReport ****
//     (Agora é async e chama getDetailedContentStats internamente)
export async function buildAggregatedReport(
    dailyMetrics: IDailyMetric[],
    userId: Types.ObjectId, // <<< Parâmetro Adicionado >>>
    startDate: Date,        // <<< Parâmetro Adicionado >>>
    // Models são necessários para a chamada interna a getDetailedContentStats
    dailyMetricModel: Model<IDailyMetric>,
    metricModel: Model<IMetric>
): Promise<AggregatedReport> { // <<< Retorna Promise agora >>>

  // Retorno padrão para input vazio (mantido)
  if (!dailyMetrics || dailyMetrics.length === 0) {
    logger.warn('[buildAggregatedReport v3.2] Recebeu array de dailyMetrics vazio. Retornando relatório padrão.');
    return {
        top3: [],
        bottom3: [],
        dayOfWeekStats: [],
        durationStats: [],
        detailedContentStats: [], // Retorna array vazio para o novo campo
        overallStats: undefined
    };
  }

  // Lógica para cálculos básicos (mantida conforme seu código original)
  logger.debug(`[buildAggregatedReport v3.2] Processando ${dailyMetrics.length} métricas diárias para User ${userId}.`);

  // 1. Calcular Overall Stats (Sua Lógica Mantida)
  const initialOverall = { /*...*/ };
  const overallSum = dailyMetrics.reduce((acc, metric) => { /*...*/ return acc; }, initialOverall);
  const overallStats: OverallStats | undefined = overallSum.count > 0 ? { /*...*/ } : undefined;
  // (Cole aqui sua lógica completa de reduce e cálculo de overallStats)
  const calculateOverallStats = (metrics: IDailyMetric[]): OverallStats | undefined => {
      const initial = { totalCurtidas: 0, totalComentarios: 0, totalCompartilhamentos: 0, totalVisualizacoes: 0, totalSalvamentos: 0, count: 0 };
      const sum = metrics.reduce((acc, metric) => {
          acc.totalCurtidas += metric.stats?.curtidas ?? 0;
          acc.totalComentarios += metric.stats?.comentarios ?? 0;
          acc.totalCompartilhamentos += metric.stats?.compartilhamentos ?? 0;
          acc.totalVisualizacoes += metric.stats?.visualizacoes ?? 0;
          acc.totalSalvamentos += metric.stats?.salvamentos ?? 0;
          acc.count += 1;
          return acc;
      }, initial);
      return sum.count > 0 ? { _id: null, ...sum, avgCurtidas: sum.totalCurtidas / sum.count, avgComentarios: sum.totalComentarios / sum.count, avgCompartilhamentos: sum.totalCompartilhamentos / sum.count, avgVisualizacoes: sum.totalVisualizacoes / sum.count, avgSalvamentos: sum.totalSalvamentos / sum.count } : undefined;
  };
  const finalOverallStats = calculateOverallStats(dailyMetrics);


  // 2. Calcular Top 3 / Bottom 3 (Sua Lógica Mantida - Exemplo por compartilhamentos)
  const sortedByShares = [...dailyMetrics].sort((a, b) => (b.stats?.compartilhamentos ?? 0) - (a.stats?.compartilhamentos ?? 0));
  const top3 = sortedByShares.slice(0, 3);
  const bottom3 = sortedByShares.slice(-3).reverse();

  // 3. Calcular DayOfWeek Stats (Sua Lógica Mantida)
  const dayMap: { [key: string]: { totalShares: number, count: number } } = {};
  const dayOrder = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  dailyMetrics.forEach(metric => { /*...*/ }); // (Cole aqui sua lógica completa do forEach)
  dailyMetrics.forEach(metric => {
    try {
        if (metric.postDate && metric.postDate instanceof Date && !isNaN(metric.postDate.getTime())) {
            const dayOfWeek = metric.postDate.getUTCDay();
            const dayName = mapDayOfWeek(dayOfWeek);
            if (!dayMap[dayName]) { dayMap[dayName] = { totalShares: 0, count: 0 }; }
            dayMap[dayName].totalShares += metric.stats?.compartilhamentos ?? 0;
            dayMap[dayName].count += 1;
        } else { logger.warn(`[buildAggregatedReport v3.2] Data inválida DayOfWeek: ${metric.postDate}`); }
    } catch (e) { logger.warn(`[buildAggregatedReport v3.2] Erro DayOfWeek: ${metric.postDate}`, e); }
  });
  const dayOfWeekStats: DayOfWeekStat[] = Object.entries(dayMap).map(([dayName, data]) => ({
    dayName, averageShares: data.count > 0 ? data.totalShares / data.count : 0, totalPosts: data.count,
  })).sort((a, b) => dayOrder.indexOf(a.dayName) - dayOrder.indexOf(b.dayName));

  // 4. Calcular Duration Stats (Sua Lógica Mantida)
  const durations = [ /*...*/ ]; // (Cole aqui sua definição de durations)
  const durationMap: { [range: string]: { totalShares: number, count: number } } = {};
  durations.forEach(d => { durationMap[d.range] = { totalShares: 0, count: 0 }; });
  dailyMetrics.forEach(metric => { /*...*/ }); // (Cole aqui sua lógica completa do forEach)
  const finalDurations = [
      { range: '0-15s', min: 0, max: 15 }, { range: '15-29s', min: 15, max: 29 },
      { range: '30-59s', min: 30, max: 59 }, { range: '60s+', min: 60, max: Infinity },
  ];
  const finalDurationMap: { [range: string]: { totalShares: number, count: number } } = {};
  finalDurations.forEach(d => { finalDurationMap[d.range] = { totalShares: 0, count: 0 }; });
   dailyMetrics.forEach(metric => {
      const duration = metric.stats?.duracao;
      if (typeof duration === 'number' && isFinite(duration) && duration >= 0) {
          const foundRange = finalDurations.find(d => duration >= d.min && duration < d.max);
          const targetRange = foundRange ? foundRange.range : (finalDurations.length > 0 && duration >= finalDurations[finalDurations.length-1].min ? finalDurations[finalDurations.length-1].range : null);
          if (targetRange && finalDurationMap[targetRange]) {
              finalDurationMap[targetRange].totalShares += metric.stats?.compartilhamentos ?? 0;
              finalDurationMap[targetRange].count += 1;
          } else if(targetRange) {
               logger.warn(`[buildAggregatedReport v3.2] Chave de duração (${targetRange}) não encontrada no mapa.`);
          }
      } else if (duration !== undefined) {
          logger.warn(`[buildAggregatedReport v3.2] Duração inválida encontrada: ${duration} para métrica ID: ${metric._id}`);
      }
  });
  const durationStats: DurationStat[] = finalDurations.map(d => {
       const statsForRange = finalDurationMap[d.range];
       const count = statsForRange?.count ?? 0;
       return { range: d.range, contentCount: count, averageShares: count > 0 ? (statsForRange.totalShares / count) : 0 };
   });
   // --- Fim da lógica mantida ---


  // <<< NOVO v3.2: Busca as estatísticas detalhadas por Formato/Proposta/Contexto >>>
  let detailedContentStats: DetailedContentStat[] = [];
  try {
      detailedContentStats = await getDetailedContentStats(
          userId,
          startDate,
          dailyMetricModel, // Passa o Model recebido
          metricModel       // Passa o Model recebido
      );
       logger.debug(`[buildAggregatedReport v3.2] detailedContentStats buscados: ${detailedContentStats.length} itens.`);
  } catch (error) {
       logger.error(`[buildAggregatedReport v3.2] Erro ao buscar detailedContentStats:`, error);
       // Continua mesmo se falhar, mas loga o erro e retorna array vazio
  }
  // <<< FIM NOVO v3.2 >>>

  // Retorna o relatório agregado completo
  return {
    top3,
    bottom3,
    dayOfWeekStats,
    durationStats,
    detailedContentStats, // <<< Adicionado ao retorno >>>
    overallStats: finalOverallStats, // Usa a variável final calculada
  };
}

// **** Função mapDayOfWeek (Mantida) ****
function mapDayOfWeek(dow: number): string {
   const names = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
   if (dow >= 0 && dow <= 6) {
       return names[dow]!;
   }
   return "Desconhecido";
}


// <<< ATUALIZADO v3.2: Função para Stats Detalhados (antiga getProposalContextStats) >>>
// ======================================================================================

/**
 * <<< ATUALIZADO v3.2 >>>
 * Busca estatísticas médias de DailyMetric agrupadas por Formato, Proposta e Contexto
 * do Metric relacionado, usando $lookup a partir da coleção DailyMetric.
 *
 * @param userId ID do usuário para filtrar as métricas.
 * @param startDate Data inicial para considerar as métricas.
 * @param dailyMetricModel O modelo Mongoose DailyMetric.
 * @param metricModel O modelo Mongoose Metric.
 * @returns Promise<DetailedContentStat[]> Array com as estatísticas agregadas.
 */
export async function getDetailedContentStats( // <<< Nome Atualizado
  userId: Types.ObjectId,
  startDate: Date,
  dailyMetricModel: Model<IDailyMetric>,
  metricModel: Model<IMetric>
): Promise<DetailedContentStat[]> {
  logger.debug(`[getDetailedContentStats v3.2] Buscando stats por Formato/Proposta/Contexto para User ${userId} desde ${formatISO(startDate)}`);

  const pipeline: any[] = [
    // 1. Filtra DailyMetrics relevantes (usuário, data, com postId válido)
    { $match: {
        user: userId,
        postDate: { $gte: startDate },
        postId: { $exists: true, $ne: null }
    }},
    // 2. Junta com a coleção Metric usando postId
    { $lookup: {
        from: metricModel.collection.name, // Nome da coleção Metric
        localField: "postId",
        foreignField: "_id",
        as: "metricInfo" // Nome do array onde o documento Metric será adicionado
    }},
    // 3. Desconstrói o array metricInfo (geralmente terá 0 ou 1 elemento)
    //    preserveNullAndEmptyArrays: true -> Mantém o DailyMetric mesmo se não encontrar Metric correspondente (útil para debug, mas filtraremos depois)
    { $unwind: {
        path: "$metricInfo",
        preserveNullAndEmptyArrays: true
    }},
    // 4. Garante que só prossigam os documentos onde o $lookup encontrou um Metric correspondente
    { $match: {
        "metricInfo._id": { $exists: true }
    }},
    // 5. Agrupa pelos campos classificados do Metric e calcula médias das stats do DailyMetric
    { $group: {
        _id: {
            // Agrupa por format, proposal e context do documento Metric juntado
            // Usa $ifNull para usar o valor default do schema caso o campo esteja ausente no documento (embora não devesse com a classificação)
            format: { $ifNull: ["$metricInfo.format", "Desconhecido"] },
            proposal: { $ifNull: ["$metricInfo.proposal", "Outro"] },
            context: { $ifNull: ["$metricInfo.context", "Geral"] }
        },
        // Calcula as médias das métricas desejadas do DailyMetric.stats
        avgCompartilhamentos: { $avg: "$stats.compartilhamentos" },
        avgSalvamentos: { $avg: "$stats.salvamentos" },
        avgCurtidas: { $avg: "$stats.curtidas" }, // Adicionando curtidas como exemplo
        count: { $sum: 1 } // Conta quantos posts caem em cada grupo
    }},
    // 6. Ordena os resultados (opcional, mas útil)
    //    Ex: por quantidade de posts e depois por compartilhamentos médios
    { $sort: {
        count: -1,                      // Mais posts primeiro
        "avgCompartilhamentos": -1      // Depois, mais compartilhamentos primeiro
    }},
    // 7. Limita a quantidade de resultados (opcional)
    // { $limit: 50 } // Descomente se quiser limitar o número de combinações retornadas
  ];

  try {
    // Executa a agregação
    const results: DetailedContentStat[] = await dailyMetricModel.aggregate(pipeline).exec();
    logger.debug(`[getDetailedContentStats v3.2] Encontrados ${results.length} agrupamentos detalhados (Formato/Proposta/Contexto).`);
    return results;
  } catch (error) {
    logger.error(`[getDetailedContentStats v3.2] Erro ao agregar detalhadamente para User ${userId}:`, {
        message: error instanceof Error ? error.message : String(error),
        // Descomente para debug detalhado:
        // stack: error instanceof Error ? error.stack : undefined,
        // pipeline: JSON.stringify(pipeline)
    });
    return []; // Retorna array vazio em caso de erro
  }
}
// <<< FIM: Função para Stats Detalhados >>>