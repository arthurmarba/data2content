// @/app/lib/communityProcessorService.ts - v1.1.3 (Corrige importações ausentes)
// - CORRIGIDO: Adicionadas as importações de VALID_TONES, VALID_REFERENCES e seus tipos e defaults correspondentes.
// - CORRIGIDO: `mapToEnum` agora usa o primeiro elemento dos arrays de classificação (format, proposal, context).
// - CORRIGIDO: Condição para `reelAvgWatchTimeSec` agora usa `includes('Reel')` no array de formato.
// - Baseado na v1.1.1.

import { logger } from '@/app/lib/logger';
import { IMetric, IMetricStats } from '@/app/models/Metric'; // Assegure que IMetric.format usa FormatType
import { IUser, IUserPreferences } from '@/app/models/User';
import { ICommunityInspiration, IInternalMetricsSnapshot } from '@/app/models/CommunityInspiration';
import OpenAI from 'openai';
import {
    VALID_FORMATS,
    VALID_PROPOSALS,
    VALID_CONTEXTS,
    VALID_TONES,
    VALID_REFERENCES,
    VALID_QUALITATIVE_OBJECTIVES,
    VALID_PERFORMANCE_HIGHLIGHTS,
    FormatType,
    ProposalType,
    ContextType,
    ToneType,
    ReferenceType,
    QualitativeObjectiveType,
    PerformanceHighlightType,
    DEFAULT_FORMAT_ENUM,
    DEFAULT_PROPOSAL_ENUM,
    DEFAULT_CONTEXT_ENUM,
    DEFAULT_TONE_ENUM,
    DEFAULT_REFERENCE_ENUM
} from "@/app/lib/constants/communityInspirations.constants";

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
const GOOD_REEL_RETENTION_RATE_SECONDS = 30; // em segundos
const MIN_STATS_FOR_HIGHLIGHTS = {
    reach: 100,
    views: 100,
};

/**
 * Helper para mapear uma string de entrada para um valor de enum válido, com fallback.
 */
function mapToEnum<T extends string>(
    value: string | undefined | null, // Aceita string de IMetric.format que pode não ser do Enum ainda
    validEnumValues: readonly T[],
    defaultValue: T
): T {
    if (value && validEnumValues.includes(value as T)) {
        return value as T;
    }
    if (value) {
        const lowerValue = value.toLowerCase();
        // Tenta um match case-insensitive ou com pequenas variações comuns
        const found = validEnumValues.find(v => {
            const vLower = v.toLowerCase();
            if (vLower === lowerValue) return true;
            // Adicione outros mapeamentos simples se necessário, ex: "foto unica" -> "Foto"
            if (v === "Foto" && lowerValue === "foto unica") return true;
            if (v === "Vídeo Longo" && lowerValue === "video longo") return true;
            return false;
        });
        if (found) return found;
    }
    logger.warn(`[mapToEnum] Valor "${value}" não encontrado em [${validEnumValues.join(', ')}]. Usando default "${defaultValue}".`);
    return defaultValue;
}


/**
 * Gera um resumo estratégico e criativo para um post usando a IA.
 */
async function generateContentSummaryForInspiration(
    description: string | undefined,
    format: FormatType | undefined,
    proposal: ProposalType | undefined,
    context: ContextType | undefined,
    stats: IMetricStats | undefined
): Promise<string> {
    const fnTag = '[communityProcessorService][generateContentSummaryForInspiration v1.1.1]';
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
        logger.debug(`${fnTag} Gerando resumo para descrição: "${description.substring(0, 50)}..."`);
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
 * ATUALIZADO v1.1.1
 */
function deriveQualitativePerformance(
    stats: IMetricStats | undefined,
    userFollowers: number | undefined = 0
): { highlights: PerformanceHighlightType[], primaryObjective: QualitativeObjectiveType } {
    const fnTag = '[communityProcessorService][deriveQualitativePerformance v1.1.1]';
    const highlights: PerformanceHighlightType[] = [];
    let primaryObjective: QualitativeObjectiveType = 'desempenho_geral_interessante';

    if (!stats) {
        logger.debug(`${fnTag} Sem stats detalhadas para derivação.`);
        return { highlights: ['sem_metricas_detalhadas_para_analise'], primaryObjective: 'analise_qualitativa_do_conteudo' };
    }

    const reach = stats.reach ?? 0;
    const saves = stats.saved ?? 0;
    const shares = stats.shares ?? 0;
    const comments = stats.comments ?? 0;
    const likes = stats.likes ?? 0;
    const views = stats.views ?? stats.video_views ?? 0;

    if (reach < MIN_STATS_FOR_HIGHLIGHTS.reach && views < MIN_STATS_FOR_HIGHLIGHTS.views) {
        logger.debug(`${fnTag} Baixo volume de dados (reach/views) para destaques significativos.`);
        highlights.push('baixo_volume_de_dados');
        return { highlights, primaryObjective: 'engajamento_inicial' };
    }

    interface ObjectiveScore {
        objective: QualitativeObjectiveType;
        score: number;
    }
    let objectivesMet: ObjectiveScore[] = [];

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
        else if (highlights.includes('excelente_retencao_em_reels')) primaryObjective = 'manteve_atencao_da_audiencia';
        else if (highlights.includes('alcance_superior_a_media_de_seguidores')) primaryObjective = 'alcancou_nova_audiencia';
    }

    if (highlights.length === 0) {
        highlights.push('desempenho_padrao');
    }
    const finalHighlights = Array.from(new Set(highlights)).filter(h => VALID_PERFORMANCE_HIGHLIGHTS.includes(h as PerformanceHighlightType));

    logger.debug(`${fnTag} Destaques derivados: ${finalHighlights.join(',')}. Objetivo primário: ${primaryObjective}`);
    return { highlights: finalHighlights as PerformanceHighlightType[], primaryObjective };
}


/**
 * Transforma um IMetric em um objeto parcial ICommunityInspiration.
 * ATUALIZADO v1.1.2
 */
export async function processMetricForCommunity(
    metric: IMetric, // Assegure-se que IMetric.format é FormatType, .proposal é ProposalType, etc.
    user: IUser
): Promise<Partial<ICommunityInspiration>> {
    const fnTag = '[communityProcessorService][processMetricForCommunity v1.1.2]';
    logger.info(`${fnTag} Processando Metric ${metric._id} para User ${user._id}`);

    // Mapeamento para os enums com fallbacks
    // Usa os valores DEFAULT_..._ENUM do arquivo de constantes, que são membros dos enums.
    // CORREÇÃO: As propriedades format, proposal e context agora são arrays. Usamos o primeiro elemento [0] para o mapeamento.
    const mappedFormat = mapToEnum(metric.format?.[0], VALID_FORMATS, DEFAULT_FORMAT_ENUM);
    const mappedProposal = mapToEnum(metric.proposal?.[0], VALID_PROPOSALS, DEFAULT_PROPOSAL_ENUM);
    const mappedContext = mapToEnum(metric.context?.[0], VALID_CONTEXTS, DEFAULT_CONTEXT_ENUM);
    const mappedTone = mapToEnum(metric.tone?.[0], VALID_TONES, DEFAULT_TONE_ENUM);
    const mappedReference = mapToEnum(metric.references?.[0], VALID_REFERENCES, DEFAULT_REFERENCE_ENUM);


    if (!metric.stats) {
        logger.warn(`${fnTag} Métrica ${metric._id} sem 'stats'. Pulando derivação de performance.`);
        const basicSummary = await generateContentSummaryForInspiration(
            metric.description,
            mappedFormat,
            mappedProposal,
            mappedContext,
            undefined
        );
        return {
            postId_Instagram: metric.instagramMediaId || `manual_${metric._id.toString()}`,
            originalInstagramPostUrl: metric.postLink,
            originalCreatorId: user._id,
            proposal: mappedProposal,
            context: mappedContext,
            format: mappedFormat,
            tone: mappedTone,
            reference: mappedReference,
            contentSummary: basicSummary,
            performanceHighlights_Qualitative: ['sem_metricas_detalhadas_para_analise'],
            primaryObjectiveAchieved_Qualitative: 'analise_qualitativa_do_conteudo',
            addedToCommunityAt: new Date(),
            status: 'active',
        };
    }

    const contentSummary = await generateContentSummaryForInspiration(
        metric.description,
        mappedFormat,
        mappedProposal,
        mappedContext,
        metric.stats as IMetricStats
    );

    const { highlights, primaryObjective } = deriveQualitativePerformance(
        metric.stats as IMetricStats,
        user.followers_count
    );

    const internalSnapshot: IInternalMetricsSnapshot = {};
    if (metric.stats.reach && user.followers_count && user.followers_count > 0) {
        internalSnapshot.reachToFollowersRatio = parseFloat((metric.stats.reach / user.followers_count).toFixed(2));
    }
    if (metric.stats.saved && metric.stats.reach && metric.stats.reach > 0) {
        internalSnapshot.saveRate = parseFloat((metric.stats.saved / metric.stats.reach).toFixed(4));
    }
    if (metric.stats.shares && metric.stats.reach && metric.stats.reach > 0) {
        internalSnapshot.shareRate = parseFloat((metric.stats.shares / metric.stats.reach).toFixed(4));
    }

    // CORREÇÃO: Checa apenas o campo `format` padronizado para determinar se é Reel
    if (metric.format?.some(f => f.toLowerCase() === 'reel') && metric.stats.ig_reels_avg_watch_time) {
        internalSnapshot.reelAvgWatchTimeSec = parseFloat((metric.stats.ig_reels_avg_watch_time / 1000).toFixed(1));
    }

    const inspirationPartial: Partial<ICommunityInspiration> = {
        postId_Instagram: metric.instagramMediaId || `manual_${metric._id.toString()}`,
        originalInstagramPostUrl: metric.postLink,
        originalCreatorId: user._id,
        proposal: mappedProposal,
        context: mappedContext,
        format: mappedFormat,
        tone: mappedTone,
        reference: mappedReference,
        contentSummary: contentSummary,
        performanceHighlights_Qualitative: highlights,
        primaryObjectiveAchieved_Qualitative: primaryObjective,
        addedToCommunityAt: new Date(),
        status: 'active',
        internalMetricsSnapshot: Object.keys(internalSnapshot).length > 0 ? internalSnapshot : undefined,
    };

    logger.info(`${fnTag} Processamento concluído para Metric ${metric._id}. Resumo: "${contentSummary.substring(0, 50)}...", Destaques: ${highlights.join(',')}`);
    return inspirationPartial;
}
