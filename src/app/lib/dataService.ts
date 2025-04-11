// @/app/lib/dataService.ts - v2.1 (Mensagem Clarificação Roteiro Atualizada)

import { Model, Types } from "mongoose";
import User, { IUser } from "@/app/models/User";
import { DailyMetric, IDailyMetric } from "@/app/models/DailyMetric";
import Metric, { IMetric } from "@/app/models/Metric";
import { subDays } from "date-fns";
import { logger } from '@/app/lib/logger';

// Importa funções e tipos de reportHelpers (Assumindo que ReportAggregationError e DetailedStatsError vêm daqui)
import {
    buildAggregatedReport,
    AggregatedReport,
    DurationStat,
    OverallStats,
    DetailedContentStat, // Usado em IEnrichedReport e fetchAndPrepareReportData
    ProposalStat,        // Usado em IEnrichedReport
    ContextStat,         // Usado em IEnrichedReport
    ReportAggregationError,
    DetailedStatsError
} from "@/app/lib/reportHelpers";

// Importa tipos de erro personalizados
import {
    BaseError, UserNotFoundError, MetricsNotFoundError,
    DatabaseError // AIError, CacheError não são usados diretamente aqui
} from "@/app/lib/errors";

// --- Constantes Usadas Internamente (Podem ser movidas para um arquivo central) ---

const METRICS_FETCH_DAYS_LIMIT = 180;
// SCRIPT_KEYWORDS é usado por extractReferenceAndFindPost. Poderia ser importado de intentService se ele exportar.
const SCRIPT_KEYWORDS = ["roteiro", "script", "estrutura", "outline", "sequencia", "escreve pra mim", "como fazer video sobre", "estrutura de post", "roteiriza"];


// --- Interfaces e Tipos Relacionados a Dados ---

// Define a estrutura da entrada para fetchAndPrepareReportData
interface ReportDataInput {
    user: IUser;
    dailyMetricModel: Model<IDailyMetric>; // Passando modelos para flexibilidade/teste
    contentMetricModel: Model<IMetric>;
}

// Define a estrutura do resultado de fetchAndPrepareReportData (apenas o relatório enriquecido)
interface PreparedData {
    enrichedReport: IEnrichedReport;
}

// Define a estrutura do resultado de extractReferenceAndFindPost
export type ReferenceSearchResult =
    | { status: 'found'; post: { _id: Types.ObjectId; description: string; proposal?: string; context?: string; } }
    | { status: 'clarify'; message: string }
    | { status: 'error'; message: string };

// Estende DetailedContentStat para incluir exemplos (se buildAggregatedReport os adicionar)
// Esta interface define a estrutura esperada DENTRO de IEnrichedReport
interface UpdatedDetailedContentStat extends DetailedContentStat {
    topExamplesInGroup?: Pick<IMetric, '_id' | 'description' | 'postLink'>[];
}

// Interface para comparações de crescimento (placeholders como no original)
interface IGrowthComparisons { /* ... */ }

// Interface para o resultado de getCombinedGrowthData (placeholders)
interface IGrowthDataResult { /* ... */ }


// Interface principal para o relatório enriquecido que este serviço produz
// Usada como tipo de retorno em PreparedData e necessária para tipar o objeto construído.
export interface IEnrichedReport {
    overallStats?: OverallStats;
    profileSegment: string; // Vem de getUserProfileSegment
    multimediaSuggestion: string; // Vem de getMultimediaSuggestion
    top3Posts?: Pick<IMetric, '_id' | 'description' | 'postLink'>[]; // Vem de fetchContentDetailsForMetrics
    bottom3Posts?: Pick<IMetric, '_id' | 'description' | 'postLink'>[]; // Vem de fetchContentDetailsForMetrics
    durationStats?: DurationStat[]; // Vem de buildAggregatedReport
    detailedContentStats?: UpdatedDetailedContentStat[]; // Vem de buildAggregatedReport (com cast)
    proposalStats?: ProposalStat[]; // Vem de buildAggregatedReport
    contextStats?: ContextStat[]; // Vem de buildAggregatedReport
    historicalComparisons?: IGrowthComparisons; // Placeholder
    longTermComparisons?: IGrowthComparisons; // Placeholder
}


// --- Funções Placeholder (Relacionadas a Dados/Perfil) ---

// Obtém segmento do perfil (pode precisar acessar user.profile, etc.)
const getUserProfileSegment = (/* user: IUser */): string => {
    // Lógica para determinar o segmento do usuário (ex: Iniciante, Avançado)
    // Pode ser baseado em user.hobbies, user.createdAt, métricas, etc.
    logger.debug("[Data Service] getUserProfileSegment chamado (Placeholder)");
    return "Geral"; // Placeholder
};

// Obtém sugestão de multimídia (pode analisar métricas, perfil)
const getMultimediaSuggestion = (): string => {
    // Lógica para sugerir tipos de mídia (imagem, vídeo, carrossel)
    logger.debug("[Data Service] getMultimediaSuggestion chamado (Placeholder)");
    return ""; // Placeholder
};


// --- Funções Auxiliares de Busca de Dados ---

/**
 * Placeholder para buscar dados de crescimento combinados.
 */
async function getCombinedGrowthData(userId: Types.ObjectId, dailyMetricModel: Model<IDailyMetric>): Promise<IGrowthDataResult> {
    logger.debug(`[Data Service] getCombinedGrowthData chamado para ${userId} (Placeholder)`);
    // Implementar busca e cálculo de dados de crescimento (ex: semanal, mensal)
    return {}; // Retorna placeholder
}

/**
 * Busca detalhes (_id, description, postLink) de posts de conteúdo
 * com base em uma lista de métricas diárias que contêm postIds.
 */
async function fetchContentDetailsForMetrics(
    metricsToFetch: IDailyMetric[] | undefined,
    contentMetricModel: Model<IMetric>
): Promise<Pick<IMetric, '_id' | 'description' | 'postLink'>[] | undefined> {
    if (!metricsToFetch || metricsToFetch.length === 0) {
        logger.debug("[Data Service] fetchContentDetailsForMetrics: Sem métricas para buscar detalhes.");
        return undefined;
    }

    // Extrai IDs válidos de posts das métricas diárias
    const postIds = metricsToFetch
        .map(dm => dm.postId)
        .filter((id): id is Types.ObjectId => !!id && Types.ObjectId.isValid(id));

    if (postIds.length === 0) {
        logger.debug("[Data Service] fetchContentDetailsForMetrics: Sem postIds válidos nas métricas.");
        return [];
    }

    logger.debug(`[Data Service] fetchContentDetailsForMetrics: Buscando detalhes para ${postIds.length} postIds.`);
    try {
        const contentMetrics = await contentMetricModel.find(
            { _id: { $in: postIds } }
        ).select('_id description postLink').lean().exec(); // Busca apenas os campos necessários

        // Mapeia os resultados por ID para fácil consulta
        const contentMap = new Map(contentMetrics.map(cm => [cm._id.toString(), cm]));

        // Mapeia de volta para a ordem original das métricas diárias
        const results = metricsToFetch
            .map(dm => dm.postId ? contentMap.get(dm.postId.toString()) : undefined)
            .filter(Boolean) as Pick<IMetric, '_id' | 'description' | 'postLink'>[]; // Filtra nulos/undefined

        logger.debug(`[Data Service] fetchContentDetailsForMetrics: Encontrados ${results.length} detalhes.`);
        return results;

    } catch (error) {
        logger.error(`[Data Service] Erro em fetchContentDetailsForMetrics:`, error);
        // Propaga um erro específico de banco de dados
        throw new DatabaseError(`Falha ao buscar detalhes de conteúdo para ${postIds.length} posts`, error as Error);
    }
}


// --- Funções Principais Exportadas ---

/**
 * Busca um usuário pelo número de telefone do WhatsApp.
 * @param fromPhone Número de telefone com código do país.
 * @returns O objeto IUser encontrado.
 * @throws {UserNotFoundError} Se o usuário não for encontrado.
 * @throws {DatabaseError} Se ocorrer um erro no banco de dados.
 */
export async function lookupUser(fromPhone: string): Promise<IUser> {
    const phoneForLog = fromPhone.slice(0, -4) + "****"; // Mascarar parte do número para log
    logger.debug(`[Data Service] lookupUser: Buscando usuário para ${phoneForLog}`);
    try {
        const user = await User.findOne({ whatsappPhone: fromPhone }).lean().exec();
        if (!user) {
            logger.warn(`[Data Service] lookupUser: Usuário não encontrado para ${phoneForLog}`);
            throw new UserNotFoundError(`Usuário não encontrado: ${phoneForLog}`);
        }
        logger.debug(`[Data Service] lookupUser: Usuário encontrado - ID ${user._id}`);
        // O cast 'as IUser' é razoável aqui devido ao lean(), mas garanta que o schema corresponda.
        return user as IUser;
    } catch (error) {
        if (error instanceof UserNotFoundError) {
            throw error; // Re-throw o erro específico
        }
        logger.error(`[Data Service] lookupUser: Erro de DB para ${phoneForLog}:`, error);
        throw new DatabaseError(`Erro ao buscar usuário ${phoneForLog}`, error as Error);
    }
}

/**
 * Busca e prepara os dados necessários para gerar relatórios e insights.
 * Inclui métricas diárias, dados de crescimento, agregação e detalhes de posts.
 * @param input Contém o usuário e os modelos Mongoose.
 * @returns Um objeto contendo o IEnrichedReport.
 * @throws {MetricsNotFoundError} Se não houver métricas recentes.
 * @throws {ReportAggregationError} Se a agregação falhar.
 * @throws {DatabaseError} Se ocorrer um erro no banco de dados.
 */
export async function fetchAndPrepareReportData({
    user,
    dailyMetricModel,
    contentMetricModel
}: ReportDataInput): Promise<PreparedData> {
    const userId = user._id;
    const userIdStr = userId.toString();
    logger.debug(`[Data Service] fetchAndPrepareReportData: Iniciando para user ${userIdStr}`);

    const metricsStartDate = subDays(new Date(), METRICS_FETCH_DAYS_LIMIT);
    let dailyMetricsRaw: IDailyMetric[] = [];
    let growthData: IGrowthDataResult = {};
    let aggregatedReportResult: AggregatedReport | null = null;

    try {
        // Busca métricas diárias e dados de crescimento em paralelo
        [ dailyMetricsRaw, growthData ] = await Promise.all([
            dailyMetricModel.find({
                user: userId,
                postDate: { $gte: metricsStartDate }
            })
            .select('postDate stats user postId _id') // Selecionar apenas campos necessários
            .sort({ postDate: -1 })
            .lean().exec(),
            getCombinedGrowthData(userId, dailyMetricModel), // Chama o placeholder
        ]);

        logger.debug(`[Data Service] fetchAndPrepareReportData: ${dailyMetricsRaw.length} métricas diárias brutas encontradas para ${userIdStr}.`);

        if (dailyMetricsRaw.length === 0) {
            throw new MetricsNotFoundError(`Sem métricas diárias nos últimos ${METRICS_FETCH_DAYS_LIMIT} dias para ${userIdStr}.`);
        }

        // Chama a função de agregação principal
        logger.debug(`[Data Service] fetchAndPrepareReportData: Executando buildAggregatedReport para ${userIdStr}...`);
        try {
            aggregatedReportResult = await buildAggregatedReport(
                dailyMetricsRaw,
                userId,
                metricsStartDate,
                dailyMetricModel,
                contentMetricModel // Passa o modelo de conteúdo
            );
        } catch (reportError: unknown) {
            logger.error(`[Data Service] Erro durante buildAggregatedReport para ${userIdStr}:`, reportError);
            if (reportError instanceof ReportAggregationError || reportError instanceof DetailedStatsError) {
                throw reportError; // Re-throw erros específicos da agregação
            }
             // Encapsula outros erros como ReportAggregationError
            throw new ReportAggregationError(`Falha ao gerar relatório agregado: ${reportError instanceof Error ? reportError.message : String(reportError)}`, reportError as Error);
        }
        logger.debug(`[Data Service] fetchAndPrepareReportData: buildAggregatedReport concluído.`);


        if (!aggregatedReportResult) {
             // Segurança extra, embora buildAggregatedReport deva lançar erro se falhar criticamente
            throw new ReportAggregationError(`Resultado do buildAggregatedReport é nulo ou inválido para ${userIdStr}`);
        }

         // Log das contagens de stats detalhados
        logger.debug(`[Data Service] Stats agregados: F/P/C=${aggregatedReportResult.detailedContentStats?.length ?? 0}, P=${aggregatedReportResult.proposalStats?.length ?? 0}, C=${aggregatedReportResult.contextStats?.length ?? 0}`);

        // Busca detalhes dos posts top/bottom em paralelo
        logger.debug(`[Data Service] Buscando detalhes para top/bottom 3 posts...`);
        const [top3Simplified, bottom3Simplified] = await Promise.all([
            fetchContentDetailsForMetrics(aggregatedReportResult.top3, contentMetricModel),
            fetchContentDetailsForMetrics(aggregatedReportResult.bottom3, contentMetricModel)
        ]);
        logger.debug(`[Data Service] Detalhes top/bottom posts obtidos.`);


        // Validação essencial dos dados agregados
        if (!aggregatedReportResult?.overallStats) {
            logger.error(`[Data Service] OverallStats ausentes no resultado agregado para ${userIdStr}.`);
            // Lançar MetricsNotFoundError faz sentido se os stats gerais não puderam ser calculados
            throw new MetricsNotFoundError(`Não foi possível calcular estatísticas gerais (overallStats) para ${userIdStr}`);
        }

        // Monta o objeto final enriquecido
        const enrichedReport: IEnrichedReport = {
            overallStats: aggregatedReportResult.overallStats,
            profileSegment: getUserProfileSegment(/* user */), // Chama o placeholder
            multimediaSuggestion: getMultimediaSuggestion(),   // Chama o placeholder
            top3Posts: top3Simplified,
            bottom3Posts: bottom3Simplified,
            durationStats: aggregatedReportResult.durationStats,
             // Faz o cast para o tipo que inclui topExamplesInGroup, assumindo que buildAggregatedReport pode adicioná-lo
            detailedContentStats: aggregatedReportResult.detailedContentStats as UpdatedDetailedContentStat[] | undefined,
            proposalStats: aggregatedReportResult.proposalStats,
            contextStats: aggregatedReportResult.contextStats,
            historicalComparisons: undefined, // Placeholder
            longTermComparisons: undefined, // Placeholder
            // Adicionar growthData aqui se for usá-lo diretamente no enrichedReport
        };

        logger.debug(`[Data Service] fetchAndPrepareReportData: Relatório enriquecido montado para ${userIdStr}.`);
        return { enrichedReport };

    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error(`[Data Service] Falha em fetchAndPrepareReportData para ${userIdStr}: ${msg}`, { error });

        // Re-throw erros específicos conhecidos
        if (error instanceof MetricsNotFoundError || error instanceof DatabaseError || error instanceof ReportAggregationError || error instanceof DetailedStatsError) {
            throw error;
        }
        // Trata erros específicos do MongoDB
        if (error instanceof Error && error.name === 'MongoServerError') {
            throw new DatabaseError(`Erro no DB durante preparação do relatório: ${msg}`, error);
        }
        // Encapsula erros desconhecidos
        throw new DatabaseError(`Falha desconhecida ao preparar relatório: ${msg}`, error as Error);
    }
}


/**
 * Extrai uma referência de post da mensagem do usuário e busca o post correspondente.
 * Usado principalmente para a intenção de gerar roteiros.
 * v2.1: Atualizada mensagem de clarificação.
 * @param text Mensagem do usuário.
 * @param userId ID do usuário para filtrar a busca.
 * @returns Objeto indicando se o post foi encontrado, precisa de clarificação ou houve erro.
 */
export async function extractReferenceAndFindPost(
    text: string,
    userId: Types.ObjectId
): Promise<ReferenceSearchResult> {
    const versionTag = "[Data Service v2.1]"; // Tag para logs
    logger.debug(`${versionTag} extractReferenceAndFindPost: Tentando extrair referência de: "${text.substring(0, 50)}..." para user ${userId}`);
    let referenceText: string | null = null;

    // Tenta extrair texto entre aspas
    const quoteMatch = text.match(/["'](.+?)["']/);
    if (quoteMatch && quoteMatch[1]) {
        referenceText = quoteMatch[1].trim();
        logger.debug(`${versionTag} Referência extraída (aspas): "${referenceText}"`);
    }

    // Tenta extrair texto após "sobre" ou "baseado em" (se não achou aspas)
    if (!referenceText) {
        const aboutMatch = text.match(/(?:sobre|baseado em)\s+(.+)/i);
        if (aboutMatch && aboutMatch[1]) {
            const potentialRef = aboutMatch[1].trim();
            // Tenta remover keywords de roteiro do final, se presentes
            const scriptKeywordFound = SCRIPT_KEYWORDS.find(kw => potentialRef.toLowerCase().endsWith(kw));
            referenceText = scriptKeywordFound
                ? potentialRef.substring(0, potentialRef.toLowerCase().lastIndexOf(scriptKeywordFound)).trim()
                : potentialRef;
            // Garante que não ficou vazio após remover keyword
            if (!referenceText) {
                 logger.debug(`${versionTag} Referência após keyword resultou vazia.`);
                 referenceText = null; // Descarta se ficou vazio
            } else {
                logger.debug(`${versionTag} Referência extraída (keyword): "${referenceText}"`);
            }
        }
    }

    // TODO: Adicionar lógica para extrair e validar LINKs, se necessário, e buscar por link.

    // --- PONTO DE MUDANÇA 1 ---
    if (!referenceText) {
        logger.debug(`${versionTag} Nenhuma referência textual clara encontrada para roteiro.`);
        // *** NOVA MENSAGEM DE CLARIFICAÇÃO PADRÃO ***
        return {
            status: 'clarify',
            // Mensagem atualizada v2.1
            message: "Entendi que você quer um roteiro! 👍 Para gerar o melhor roteiro, preciso saber exatamente a qual ideia ou post você se refere. Você poderia:\n\n1.  **Colar o link** do post original?\n2.  Me dar uma **descrição curta e única** do post?\n3.  Ou me dizer o **tema principal** E qual o **ângulo específico** ou **mensagem chave** que você quer abordar agora?"
        };
    }

    // Busca no banco de dados usando a referência extraída
    try {
        // Escapa caracteres regex na referência do usuário para segurança na busca
        const escapedReference = referenceText.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        logger.debug(`${versionTag} Buscando posts para User ${userId} com regex: "${escapedReference}"`);

        const potentialPosts = await Metric.find({
            user: userId,
            // Busca insensível a maiúsculas/minúsculas que contenha o texto de referência
            description: { $regex: escapedReference, $options: 'i' }
        })
        .select('_id description proposal context') // Campos necessários para o roteiro
        .limit(5) // Limita para evitar sobrecarga e apresentar opções razoáveis
        .sort({ createdAt: -1 }) // Prioriza posts mais recentes
        .lean();

        logger.debug(`${versionTag} Encontrados ${potentialPosts.length} posts potenciais para a referência "${referenceText}".`);

        // --- PONTO DE MUDANÇA 2 ---
        if (potentialPosts.length === 0) {
            logger.debug(`${versionTag} Nenhum post encontrado na busca por referência.`);
            // *** NOVA MENSAGEM PARA QUANDO A BUSCA NÃO ENCONTRA NADA ***
            return {
                status: 'clarify',
                // Mensagem atualizada v2.1
                message: `Hmm, não encontrei nenhum post recente seu sobre "${referenceText}". 😕 Para gerar o roteiro, você poderia:\n\n1.  Tentar **outras palavras-chave** da descrição?\n2.  **Colar o link** do post?\n3.  Ou me dizer o **ângulo específico** ou **mensagem chave** que você quer abordar nesse tema "${referenceText}"?`
            };
        }

        if (potentialPosts.length === 1) {
            const foundPost = potentialPosts[0];
             // Verifica se o post encontrado existe (segurança extra)
             if (foundPost) {
                logger.debug(`${versionTag} Encontrado post único: ${foundPost._id}`);
                // Verifica se a descrição existe, pois é essencial para gerar o roteiro
                if (!foundPost.description) {
                    logger.warn(`${versionTag} Post ${foundPost._id} encontrado, mas sem descrição.`);
                    return { status: 'error', message: 'Encontrei o post que você mencionou, mas ele parece não ter uma descrição para eu poder analisar e criar o roteiro. 🤔'}
                }
                // Retorna o post encontrado
                return {
                    status: 'found',
                    post: {
                        _id: foundPost._id,
                        description: foundPost.description,
                        proposal: foundPost.proposal,
                        context: foundPost.context
                    }
                };
            } else {
                 // Caso raro onde o array tem tamanho 1 mas o elemento é inválido
                 logger.error(`${versionTag} Erro lógico: potentialPosts[0] indefinido mesmo com length === 1`);
                 return { status: 'error', message: 'Erro interno ao processar o post encontrado.'};
            }
        }

        // Múltiplos posts encontrados -> Pedir clarificação (Mensagem original mantida)
        logger.debug(`${versionTag} Múltiplos posts (${potentialPosts.length}) encontrados para "${referenceText}". Pedindo clarificação.`);
        let clarifyMsg = `Encontrei ${potentialPosts.length} posts recentes sobre "${referenceText}". Para qual deles você quer o roteiro?\n\n`;
        potentialPosts.forEach((p, i) => {
            // Mostra um trecho da descrição para ajudar o usuário a escolher
            clarifyMsg += `${i + 1}. "${(p?.description || 'Sem descrição').substring(0, 60)}..."\n`;
        });
        clarifyMsg += `\nResponda com o número correspondente.`;

        return { status: 'clarify', message: clarifyMsg };

    } catch (dbError) {
        logger.error(`${versionTag} Erro no DB buscando referência de post:`, dbError);
        // Mensagem de erro genérica para falha no DB durante a busca
        return { status: 'error', message: 'Tive um problema ao buscar seus posts para o roteiro. Tente novamente mais tarde, por favor.' };
    }
}


// ====================================================
// FIM: dataService.ts (v2.1)
// ====================================================