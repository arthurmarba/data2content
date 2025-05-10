// @/app/lib/communityProcessorService.ts - v1.0.1 (Simplifica Preferência)
// - REMOVIDO: Lógica de atribuição para 'anonymityLevel' em processMetricForCommunity.
// - Mantém funcionalidades da v1.0.0.

import { logger } from '@/app/lib/logger';
import { IMetric, IMetricStats } from '@/app/models/Metric';
import { IUser } from '@/app/models/User'; // Espera-se IUser v1.9.2+ (sem communityInspirationSharingPreference)
import { ICommunityInspiration } from '@/app/models/CommunityInspiration'; // Espera-se ICommunityInspiration v1.0.1+ (sem anonymityLevel)
import OpenAI from 'openai';

// Configuração do cliente OpenAI
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const SUMMARY_MODEL = process.env.OPENAI_SUMMARY_MODEL || 'gpt-3.5-turbo';
const SUMMARY_MAX_TOKENS = 100;
const SUMMARY_TEMPERATURE = 0.5;

// Limites para definir destaques qualitativos
const HIGH_SAVE_RATE_THRESHOLD = 0.02; 
const HIGH_SHARE_RATE_THRESHOLD = 0.005; 
const HIGH_COMMENT_RATE_THRESHOLD = 0.005; 
const HIGH_REACH_FACTOR_VS_FOLLOWERS = 1.5; 
const GOOD_REEL_RETENTION_RATE_SECONDS = 30; 
const MIN_STATS_FOR_HIGHLIGHTS = { 
    reach: 100, 
    views: 100, 
};

/**
 * Gera um resumo estratégico e criativo para um post usando a IA.
 */
async function generateContentSummaryForInspiration(
    description: string | undefined,
    format: string | undefined,
    proposal: string | undefined,
    context: string | undefined,
    stats: IMetricStats | undefined
): Promise<string> {
    const fnTag = '[communityProcessorService][generateContentSummaryForInspiration v1.0.1]';
    if (!description || description.trim() === "") {
        logger.warn(`${fnTag} Descrição vazia, retornando resumo genérico.`);
        return `Post sobre ${proposal || 'tema relevante'} no contexto de ${context || 'abordagem geral'} no formato ${format || 'mídia'}.`;
    }

    let prompt = `Analise a seguinte descrição de um post do Instagram e suas características para gerar um resumo conciso (máximo 2 frases, idealmente 1) que destaque a principal estratégia ou abordagem criativa do post. O foco é em "o que fez este post ser interessante ou eficaz", não apenas reescrever a legenda.

Legenda do Post: "${description.substring(0, 500)}${description.length > 500 ? "..." : ""}"
Formato: ${format || 'Não especificado'}
Proposta de Conteúdo: ${proposal || 'Não especificado'}
Contexto da Proposta: ${context || 'Não especificado'}

Exemplos de resumos desejados:
- "Utilizou humor e uma pergunta direta na legenda para engajar sobre um problema comum da audiência."
- "Apresentou um tutorial rápido em formato de Carrossel, facilitando o salvamento."
- "Compartilhou bastidores de forma autêntica, criando conexão e curiosidade."
- "Reel com edição dinâmica e áudio em alta, focando em uma dica prática."

Resumo Estratégico/Criativo do Post:`;

    if (stats) {
        let statsSummary = "";
        if (stats.saved && stats.reach && (stats.saved / stats.reach) > HIGH_SAVE_RATE_THRESHOLD) {
            statsSummary += " Este post teve uma alta taxa de salvamentos.";
        }
        if (stats.shares && stats.reach && (stats.shares / stats.reach) > HIGH_SHARE_RATE_THRESHOLD) {
            statsSummary += " Notável pelo número de compartilhamentos.";
        }
        if (statsSummary) {
            prompt += `\nInsights de Performance Notáveis: ${statsSummary}`;
        }
    }

    try {
        logger.debug(`${fnTag} Gerando resumo para descrição: "${description.substring(0,50)}..."`);
        const completion = await openai.chat.completions.create({
            model: SUMMARY_MODEL,
            messages: [{ role: 'system', content: "Você é um especialista em análise de conteúdo de mídias sociais." }, { role: 'user', content: prompt }],
            temperature: SUMMARY_TEMPERATURE,
            max_tokens: SUMMARY_MAX_TOKENS,
            n: 1,
        });

        const summary = completion.choices[0]?.message?.content?.trim();
        if (summary) {
            logger.info(`${fnTag} Resumo gerado pela IA: "${summary}"`);
            return summary;
        }
        logger.warn(`${fnTag} IA não retornou resumo. Usando fallback.`);
        return `Post sobre ${proposal || 'tema relevante'} no contexto de ${context || 'abordagem geral'} no formato ${format || 'mídia'}, focado em sua mensagem principal.`;
    } catch (error) {
        logger.error(`${fnTag} Erro ao chamar OpenAI para gerar resumo:`, error);
        return `Análise do post sobre ${proposal || 'tema relevante'} no formato ${format || 'mídia'}.`;
    }
}

/**
 * Deriva destaques qualitativos e o principal objetivo alcançado com base nas métricas.
 */
function deriveQualitativePerformance(
    stats: IMetricStats | undefined,
    userFollowers: number | undefined = 0
): { highlights: string[], primaryObjective: string } {
    const fnTag = '[communityProcessorService][deriveQualitativePerformance v1.0.1]';
    const highlights: string[] = [];
    let primaryObjective = 'desempenho_geral_interessante'; 

    if (!stats) {
        logger.debug(`${fnTag} Sem stats detalhadas para derivação.`);
        return { highlights: ['sem_metricas_detalhadas'], primaryObjective };
    }

    const reach = stats.reach ?? 0;
    const saves = stats.saved ?? 0;
    const shares = stats.shares ?? 0;
    const comments = stats.comments ?? 0;
    const likes = stats.likes ?? 0;
    const views = stats.views ?? 0;

    if (reach < MIN_STATS_FOR_HIGHLIGHTS.reach && views < MIN_STATS_FOR_HIGHLIGHTS.views) {
        logger.debug(`${fnTag} Baixo volume de dados (reach/views) para destaques significativos.`);
        highlights.push('baixo_volume_de_dados');
        return { highlights, primaryObjective: 'engajamento_inicial' };
    }

    let objectivesMet = [];

    if (saves > 0 && reach > 0 && (saves / reach) >= HIGH_SAVE_RATE_THRESHOLD) {
        highlights.push('excelente_para_gerar_salvamentos');
        objectivesMet.push({ objective: 'gerou_muitos_salvamentos', score: (saves / reach) * 5 });
    }
    if (shares > 0 && reach > 0 && (shares / reach) >= HIGH_SHARE_RATE_THRESHOLD) {
        highlights.push('viralizou_nos_compartilhamentos');
        objectivesMet.push({ objective: 'alcance_expansivo_organico', score: (shares / reach) * 4 });
    }
    if (comments > 0 && reach > 0 && (comments / reach) >= HIGH_COMMENT_RATE_THRESHOLD) {
        highlights.push('alto_engajamento_nos_comentarios');
        objectivesMet.push({ objective: 'fomentou_discussao_rica', score: (comments / reach) * 3 });
    }
    if (userFollowers > 0 && reach > 0 && (reach / userFollowers) >= HIGH_REACH_FACTOR_VS_FOLLOWERS) {
        highlights.push('alcance_superior_a_media_de_seguidores');
        if (!objectivesMet.some(obj => obj.objective === 'alcance_expansivo_organico')) {
            objectivesMet.push({ objective: 'alcancou_nova_audiencia', score: (reach / userFollowers) });
        }
    }
    if (stats.ig_reels_avg_watch_time && (stats.ig_reels_avg_watch_time / 1000) >= GOOD_REEL_RETENTION_RATE_SECONDS) {
        highlights.push('excelente_retencao_em_reels');
        objectivesMet.push({ objective: 'manteve_atencao_da_audiencia', score: (stats.ig_reels_avg_watch_time / 10000) });
    }
    if (likes > (reach * 0.05)) { 
        highlights.push('boa_receptividade_curtidas');
    }

    if (objectivesMet.length > 0) {
        objectivesMet.sort((a, b) => b.score - a.score);
        primaryObjective = objectivesMet[0]!.objective;
    } else if (highlights.length > 0) {
        if (highlights.includes('excelente_para_gerar_salvamentos')) primaryObjective = 'gerou_muitos_salvamentos';
        else if (highlights.includes('viralizou_nos_compartilhamentos')) primaryObjective = 'alcance_expansivo_organico';
        else if (highlights.includes('alto_engajamento_nos_comentarios')) primaryObjective = 'fomentou_discussao_rica';
    }
    
    if (highlights.length === 0) {
        highlights.push('desempenho_padrao');
    }
    logger.debug(`${fnTag} Destaques derivados: ${highlights.join(',')}. Objetivo primário: ${primaryObjective}`);
    return { highlights: Array.from(new Set(highlights)), primaryObjective };
}


/**
 * Transforma um IMetric em um objeto parcial ICommunityInspiration.
 * ATUALIZADO v1.0.1: Removida atribuição de 'anonymityLevel'.
 */
export async function processMetricForCommunity(
    metric: IMetric,
    user: IUser 
): Promise<Partial<ICommunityInspiration>> {
    const fnTag = '[communityProcessorService][processMetricForCommunity v1.0.1]';
    logger.info(`${fnTag} Processando Metric ${metric._id} para User ${user._id}`);

    if (!metric.stats) {
        logger.warn(`${fnTag} Métrica ${metric._id} sem 'stats'. Pulando derivação de performance.`);
        const basicSummary = await generateContentSummaryForInspiration(metric.description, metric.format, metric.proposal, metric.context, undefined);
        return {
            postId_Instagram: metric.instagramMediaId || metric._id.toString(),
            originalInstagramPostUrl: metric.postLink,
            originalCreatorId: user._id,
            proposal: metric.proposal || 'Não classificado',
            context: metric.context || 'Não classificado',
            format: metric.format || 'Desconhecido',
            contentSummary: basicSummary,
            performanceHighlights_Qualitative: ['sem_metricas_detalhadas_para_analise'],
            primaryObjectiveAchieved_Qualitative: 'analise_qualitativa_do_conteudo',
            // anonymityLevel: user.communityInspirationSharingPreference || 'anonymous_creator', // <<< REMOVIDO >>>
            addedToCommunityAt: new Date(),
            status: 'active', 
        };
    }

    const contentSummary = await generateContentSummaryForInspiration(
        metric.description,
        metric.format,
        metric.proposal,
        metric.context,
        metric.stats as IMetricStats
    );

    const { highlights, primaryObjective } = deriveQualitativePerformance(
        metric.stats as IMetricStats, 
        user.followers_count 
    );
    
    const internalSnapshot: Record<string, any> = {};
    if (metric.stats.reach && user.followers_count && user.followers_count > 0) {
        internalSnapshot.reachToFollowersRatio = (metric.stats.reach / user.followers_count).toFixed(2);
    }
    if (metric.stats.saved && metric.stats.reach && metric.stats.reach > 0) {
        internalSnapshot.saveRate = (metric.stats.saved / metric.stats.reach).toFixed(4);
    }
    if (metric.stats.shares && metric.stats.reach && metric.stats.reach > 0) {
        internalSnapshot.shareRate = (metric.stats.shares / metric.stats.reach).toFixed(4);
    }
    if (metric.format === 'Reel' && metric.stats.ig_reels_avg_watch_time) {
        internalSnapshot.reelAvgWatchTimeSec = (metric.stats.ig_reels_avg_watch_time / 1000).toFixed(1);
    }

    const inspirationPartial: Partial<ICommunityInspiration> = {
        postId_Instagram: metric.instagramMediaId || `manual_${metric._id.toString()}`,
        originalInstagramPostUrl: metric.postLink,
        originalCreatorId: user._id,
        proposal: metric.proposal || 'Não classificado',
        context: metric.context || 'Não classificado',
        format: metric.format || 'Desconhecido',
        contentSummary: contentSummary,
        performanceHighlights_Qualitative: highlights,
        primaryObjectiveAchieved_Qualitative: primaryObjective,
        // anonymityLevel: user.communityInspirationSharingPreference || 'anonymous_creator', // <<< REMOVIDO >>>
        addedToCommunityAt: new Date(),
        status: 'active',
        internalMetricsSnapshot: Object.keys(internalSnapshot).length > 0 ? internalSnapshot : undefined,
    };

    logger.info(`${fnTag} Processamento concluído para Metric ${metric._id}. Resumo: "${contentSummary.substring(0,50)}...", Destaques: ${highlights.join(',')}`);
    return inspirationPartial;
}
