// src/app/lib/formulas.ts - v1.1 (Padronizado)

import { logger } from '@/app/lib/logger'; // Importa o logger

/**
 * Calcula métricas derivadas a partir de um array de objetos de stats brutos.
 * ATUALIZADO: Lê e retorna usando chaves canônicas (ex: 'likes', 'reach').
 *
 * @param rawDataArray Array contendo objetos de stats consolidados (com chaves canônicas).
 * Embora seja um array, na prática atual ele receberá apenas um objeto
 * vindo da consolidação em processMultipleImages.
 * @returns Objeto contendo as métricas calculadas (com chaves canônicas/descritivas).
 */
export function calcFormulas(
  rawDataArray: Record<string, unknown>[] // Espera array de objetos com chaves canônicas
): Record<string, unknown> {
  const TAG = '[calcFormulas v1.1]';
  if (!rawDataArray || rawDataArray.length === 0) {
      logger.warn(`${TAG} rawDataArray vazio ou inválido. Retornando objeto vazio.`);
      return {};
  }

  // Como processMultipleImages agora consolida tudo num objeto antes,
  // pegamos o primeiro (e único) item do array.
  const data = rawDataArray[0] || {};
  const dataCount = rawDataArray.length; // Embora seja 1, mantém a lógica original se mudar

  // Função auxiliar para obter valor numérico de forma segura
  function getNumber(key: string): number {
    const value = data[key];
    if (typeof value === "number" && !isNaN(value)) {
      return value;
    }
    if (typeof value === "string") {
      const parsed = parseFloat(value);
      if (!isNaN(parsed)) {
        return parsed;
      }
    }
    // logger.debug(`${TAG} Chave '${key}' não encontrada ou inválida no objeto de dados.`);
    return 0;
  }

  // 1) Extrai valores usando chaves canônicas
  const likes = getNumber("likes");
  const comments = getNumber("comments");
  const shares = getNumber("shares");
  const saved = getNumber("saved");
  const reach = getNumber("reach");
  const impressions = getNumber("impressions");
  const views = getNumber("views"); // Usando 'views' como chave principal
  const initial_plays = getNumber("initial_plays");
  const repeats = getNumber("repeats");
  const reel_interactions = getNumber("reel_interactions"); // Usado?
  const engaged_accounts = getNumber("engaged_accounts"); // Usado?
  const profile_visits = getNumber("profile_visits");
  const follows = getNumber("follows");
  const video_duration_seconds = getNumber("video_duration_seconds");
  const average_video_watch_time_seconds = getNumber("average_video_watch_time_seconds");
  const total_watch_time_seconds = getNumber("total_watch_time_seconds");
  const reach_followers_ratio = getNumber("reach_followers_ratio"); // Já é ratio (0-1)?
  const reach_non_followers_ratio = getNumber("reach_non_followers_ratio"); // Já é ratio (0-1)?

  // Outras métricas que podem estar presentes com chaves descritivas
  const total_interactions_manual = getNumber("total_interactions_manual"); // Exemplo

  // 2) Cálculos / taxas

  // Soma de interações principais (se não vier da API ou para recalcular)
  // Usar total_interactions_manual se existir, senão soma básica
  const totalInteractions = total_interactions_manual > 0
                            ? total_interactions_manual
                            : likes + comments + shares + saved;

  // Função auxiliar para calcular ratio seguro (evita divisão por zero)
  function safeRatio(numerator: number, denominator: number): number {
    return denominator > 0 ? numerator / denominator : 0;
  }

  // (II) Taxa de Engajamento (baseado em Alcance ou Impressões?)
  // Vamos calcular ambos para flexibilidade
  const engagement_rate_on_reach = safeRatio(totalInteractions, reach);
  const engagement_rate_on_impressions = safeRatio(totalInteractions, impressions);

  // (III) Tempo de Visualização / Retenção
  // Usa os valores médios/totais já calculados/extraídos
  const retention_rate = safeRatio(average_video_watch_time_seconds, video_duration_seconds);

  // (IV) Conversão / Crescimento
  const follower_conversion_rate = safeRatio(follows, profile_visits);

  // (V) Outros Ratios e Índices (mantendo lógica original, mas usando variáveis canônicas)
  const like_comment_ratio = safeRatio(likes, comments);
  const comment_share_ratio = safeRatio(comments, shares);
  const save_like_ratio = safeRatio(likes, saved); // Invertido? Original era salvamentos/curtidas
  const save_like_ratio_corrected = safeRatio(saved, likes); // Correção

  // Índice de Propagação (Shares / Reach)
  const propagation_index = safeRatio(shares, reach);

  // Viralidade Ponderada (exemplo, ajustar pesos alpha/beta conforme necessário)
  const alpha = 0.5; // Peso para salvamentos
  const beta = 0.3;  // Peso para repetições
  const virality_weighted = safeRatio((shares + (saved * alpha) + (repeats * beta)), reach);

  // Razão Seguir / Alcance Total
  const follow_reach_ratio = safeRatio(follows, reach);

  // Engajamento Profundo vs. Rápido (Alcance)
  const deep_interactions = comments + shares + saved;
  const fast_interactions = likes; // Simplificado (sem reacoesFacebook)
  const engagement_deep_vs_reach = safeRatio(deep_interactions, reach);
  const engagement_fast_vs_reach = safeRatio(fast_interactions, reach);
  const deep_fast_engagement_ratio = safeRatio(engagement_deep_vs_reach, engagement_fast_vs_reach);


  // 3) Monta objeto de retorno com chaves canônicas/descritivas padronizadas
  const calculatedStats: Record<string, unknown> = {
    // Métricas base (já estão no objeto 'data', mas podemos incluir aqui se for útil ter tudo junto)
    // likes: likes,
    // comments: comments,
    // ... (incluir outras métricas base se desejado) ...

    // Métricas calculadas
    total_interactions: totalInteractions, // Soma calculada aqui
    engagement_rate_on_reach: engagement_rate_on_reach,
    engagement_rate_on_impressions: engagement_rate_on_impressions,
    retention_rate: retention_rate,
    follower_conversion_rate: follower_conversion_rate,
    like_comment_ratio: like_comment_ratio,
    comment_share_ratio: comment_share_ratio,
    save_like_ratio: save_like_ratio_corrected, // Usando a versão corrigida
    propagation_index: propagation_index,
    virality_weighted: virality_weighted,
    follow_reach_ratio: follow_reach_ratio,
    engagement_deep_vs_reach: engagement_deep_vs_reach,
    engagement_fast_vs_reach: engagement_fast_vs_reach,
    deep_fast_engagement_ratio: deep_fast_engagement_ratio,

    // Adicionar outras métricas calculadas da lógica original se necessário,
    // usando nomes descritivos em inglês. Ex:
    // initial_plays_rate: safeRatio(initial_plays, views),
    // repeat_rate: safeRatio(repeats, views),
  };

  // Remove chaves com valor 0 ou NaN para limpeza (opcional)
  Object.keys(calculatedStats).forEach(key => {
      const value = calculatedStats[key];
      if (value === 0 || (typeof value === 'number' && isNaN(value))) {
          // delete calculatedStats[key]; // Descomentar para remover zeros/NaN
      }
      // Arredonda números para X casas decimais (ex: 4)
      if (typeof value === 'number' && !Number.isInteger(value)) {
          calculatedStats[key] = parseFloat(value.toFixed(4));
      }
  });


  logger.debug(`${TAG} Métricas calculadas:`, calculatedStats);
  return calculatedStats;
}
