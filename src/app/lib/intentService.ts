// @/app/lib/intentService.ts - v2.10 (Novas Intenções Analíticas)

import { IUser } from "@/app/models/User";
import { logger } from '@/app/lib/logger';

// --- Funções Utilitárias ---
const selectRandom = <T>(arr: T[]): T | undefined => { if (arr.length === 0) return undefined; return arr[Math.floor(Math.random() * arr.length)]; };
export const getRandomGreeting = (userName: string): string => { const greetings = [ `Oi ${userName}! Como posso ajudar hoje?`, `Olá ${userName}! Pronto(a) para analisar seus resultados?`, `E aí ${userName}, tudo certo? O que manda?` ]; return selectRandom(greetings) ?? `Olá ${userName}!`; };
const updateUserFeedback = async (userId: string): Promise<number | null> => { logger.debug(`[Placeholder] updateUserFeedback chamado para ${userId}`); return null; };

// --- Interface de Estado do Diálogo ---
interface IPlanItemContext { identifier: string; description: string; proposal?: string; context?: string; }
type OriginalSourceContext = { description: string; proposal?: string; context?: string; } | null;
interface IDialogueState {
    lastInteraction?: number;
    lastGreetingSent?: number;
    recentPlanIdeas?: IPlanItemContext[] | null;
    recentPlanTimestamp?: number;
    lastOfferedScriptIdea?: {
        aiGeneratedIdeaDescription: string;
        originalSource: OriginalSourceContext;
        timestamp: number;
    } | null;
}

// --- Constantes ---
const MAX_PLAN_CONTEXT_AGE_MINUTES = 30;
const MAX_WORDS_FOR_CONTEXTUAL_INTENT = 7;
const MAX_OFFERED_SCRIPT_CONTEXT_AGE_MINUTES = 15;
const MAX_WORDS_FOR_GREETING_CASE = 4;

// --- Listas de Palavras-chave (Keywords) ---
const POSITIVE_SENTIMENT_KEYWORDS = ["bom", "ótimo", "legal", "gostei", "excelente", "feliz", "aumentou", "cresceu", "sim", "curti", "ajudou", "obrigado", "obrigada", "aplicável", "útil", "util"];
const NEGATIVE_SENTIMENT_KEYWORDS = ["ruim", "péssimo", "triste", "problema", "difícil", "caiu", "diminuiu", "preocupado", "não", "nao", "confuso", "perdi", "piorou", "inválido", "genérico"];
const GREETING_KEYWORDS = ["oi", "olá", "ola", "tudo bem", "bom dia", "boa tarde", "boa noite", "e aí", "eae"];
const FEEDBACK_POSITIVE_KEYWORDS = ["sim", "gostei", "útil", "util", "aplicável", "ajudou", "boa"];
const FEEDBACK_NEGATIVE_KEYWORDS = ["não", "nao"];
const FEEDBACK_NEUTRAL_RESPONSE_WORDS = ["não", "nao"];
const CONTENT_IDEAS_KEYWORDS = [ "ideia", "ideias", "conteúdo", "sugestão de post", "sugestões de post", "sugere", "sugestão", "o que postar", "inspiração", "exemplos de posts", "dicas de conteúdo", "ideias criativas" ];
const REPORT_KEYWORDS = ["relatório", "relatorio", "plano", "estratégia", "detalhado", "completo", "performance", "analisa", "analise", "visão geral", "resultado", "resultados", "desempenho"];
const CONTENT_PLAN_KEYWORDS = ["planejamento", "plano de conteudo", "agenda de posts", "calendario editorial", "o que postar essa semana", "sugestao de agenda", "me da um plano", "cria um plano"];
const RANKING_KEYWORDS = ["ranking", "top", "melhores", "piores", "classificação", "quais performam", "performam melhor", "performam pior", "lista de"];
const SCRIPT_KEYWORDS = ["roteiro", "script", "estrutura", "outline", "sequencia", "escreve pra mim", "como fazer video sobre", "estrutura de post", "roteiriza"];
const AMBIGUOUS_REFERENCE_KEYWORDS = [ "primeiro", "primeira", "segundo", "segunda", "terceiro", "terceira", "quarto", "quarta", "quinto", "quinta", "1", "2", "3", "4", "5", "segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo", "esse", "essa", "este", "esta", "aquele", "aquela", "gostei", "quero", "faz", "fazer", "pode ser", "manda", "o ultimo", "a ultima", "ultimo", "ultima" ];
const AMBIGUOUS_REFERENCE_REGEX = /\b(gostei d[oa]|quero [oa]|faz [oa]|fazer [oa]|pode ser [oa]|mand[ae] [oa])\s+(.+)/i;

// *** NOVAS KEYWORDS ***
const ASK_BEST_PERFORMER_KEYWORDS = ["qual tipo", "qual conteudo", "qual proposta", "qual contexto", "gera mais", "melhor desempenho", "maior desempenho", "recordista em", "performam melhor", "quais dao mais", "o que da mais"];
const BEST_TIME_KEYWORDS = ["melhor dia", "melhor hora", "melhor horario", "qual dia", "qual hora", "qual horario", "quando postar", "frequencia", "cadencia"]; // Mantida, mas agora para intent principal

// Lista de exclusão atualizada para incluir novas keywords se necessário (avaliar se precisa)
const STRONG_INTENT_KEYWORDS_EXCLUSION = [
    ...CONTENT_PLAN_KEYWORDS, ...RANKING_KEYWORDS, ...REPORT_KEYWORDS,
    ...CONTENT_IDEAS_KEYWORDS, ...ASK_BEST_PERFORMER_KEYWORDS, ...BEST_TIME_KEYWORDS
];


// --- Função de Normalização ---
export function normalizeText(text: string | undefined | null): string {
    if (!text) return "";
    try {
        return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    } catch (error) {
        logger.warn(`[normalizeText] Erro ao normalizar texto: "${text}"`, error);
        // Fallback to simple lowercase if normalization fails
        return text.toLowerCase();
    }
}

// --- Keywords Normalizadas ---
const NORMALIZED_GREETING_KEYWORDS = GREETING_KEYWORDS.map(normalizeText);
const NORMALIZED_FEEDBACK_POSITIVE_KEYWORDS = FEEDBACK_POSITIVE_KEYWORDS.map(normalizeText);
const NORMALIZED_FEEDBACK_NEGATIVE_KEYWORDS = FEEDBACK_NEGATIVE_KEYWORDS.map(normalizeText);
const NORMALIZED_CONTENT_IDEAS_KEYWORDS = CONTENT_IDEAS_KEYWORDS.map(normalizeText);
const NORMALIZED_REPORT_KEYWORDS = REPORT_KEYWORDS.map(normalizeText);
const NORMALIZED_CONTENT_PLAN_KEYWORDS = CONTENT_PLAN_KEYWORDS.map(normalizeText);
const NORMALIZED_RANKING_KEYWORDS = RANKING_KEYWORDS.map(normalizeText);
const NORMALIZED_SCRIPT_KEYWORDS = SCRIPT_KEYWORDS.map(normalizeText);
const NORMALIZED_AMBIGUOUS_REFERENCE_KEYWORDS = AMBIGUOUS_REFERENCE_KEYWORDS.map(normalizeText);
const NORMALIZED_ASK_BEST_PERFORMER_KEYWORDS = ASK_BEST_PERFORMER_KEYWORDS.map(normalizeText); // Normaliza novas keywords
const NORMALIZED_BEST_TIME_KEYWORDS = BEST_TIME_KEYWORDS.map(normalizeText); // Normaliza keywords de tempo

// Remove duplicados e palavras curtas da lista de exclusão
const NORMALIZED_STRONG_INTENT_KEYWORDS_EXCLUSION = [...new Set(STRONG_INTENT_KEYWORDS_EXCLUSION)]
    .map(normalizeText)
    .filter(kw => kw.length > 1);


// --- Funções Auxiliares de Intenção ---
function includesAnyKeyword(normalizedText: string, normalizedKeywords: ReadonlyArray<string>): boolean {
    for (const keyword of normalizedKeywords) {
        // Check if keyword is valid and included in the text
        if (keyword && normalizedText.includes(keyword)) {
            return true;
        }
    }
    return false;
}
function containsAmbiguousReference(normalizedText: string): boolean {
    const fnTag = "[containsAmbiguousReference]";
    if (includesAnyKeyword(normalizedText, NORMALIZED_AMBIGUOUS_REFERENCE_KEYWORDS)) {
        logger.debug(`${fnTag} Match encontrado por keyword direta em: "${normalizedText}"`);
        return true;
    }
    if (AMBIGUOUS_REFERENCE_REGEX.test(normalizedText)) {
        logger.debug(`${fnTag} Match encontrado por regex em: "${normalizedText}"`);
        return true;
    }
    logger.debug(`${fnTag} Nenhum match de referência ambígua encontrado em: "${normalizedText}"`);
    return false;
}

/**
 * Verifica se a consulta normalizada do usuário é uma confirmação simples e curta.
 */
export function isSimpleConfirmation(
    normalizedQuery: string,
    maxWordsConsideredShort: number = 3
): boolean {
    const fnTag = "[isSimpleConfirmation v2.X Refined+TypeFix]";
    const strongConfirmations = new Set([ 'sim', 's', 'ok', 'okay', 'claro', 'pode ser', 'pode crer', 'manda', 'manda ver', 'beleza', 'blz', 'ta bom', 'tabom', 'combinado', 'bora', 'uhum', 'aham', 'confirmo', 'confirmado' ]);
    const potentiallyAmbiguousUnique = new Set<string>([ /* Vazio por enquanto */ ]);
    const potentiallyAmbiguousStarters = new Set([ 'pode', 'quero' ]);

    if (strongConfirmations.has(normalizedQuery)) { logger.debug(`${fnTag} Match exato com confirmação forte: "${normalizedQuery}"`); return true; }
    if (potentiallyAmbiguousUnique.has(normalizedQuery)) { logger.debug(`${fnTag} Match exato com palavra potencialmente ambígua (única): "${normalizedQuery}"`); return true; }

    const words = normalizedQuery.split(' ').filter(Boolean);
    const wordCount = words.length;
    const firstWord = words[0];

    if (firstWord !== undefined && potentiallyAmbiguousStarters.has(firstWord)) {
        if (wordCount <= maxWordsConsideredShort) {
            const secondWord = words[1];
            // Check if the second word indicates a new request rather than confirming the previous one
            const likelyNewRequestIndicator = secondWord && (
                includesAnyKeyword(secondWord, NORMALIZED_STRONG_INTENT_KEYWORDS_EXCLUSION) || // Check against combined list
                ['um', 'o', 'a', 'me', 'pra', 'para'].includes(secondWord)
            );
            if (!likelyNewRequestIndicator) { logger.debug(`${fnTag} Match no início com palavra ambígua ('${firstWord}') em frase curta (${wordCount} palavras) sem indicador de novo pedido. Considerando confirmação.`); return true; }
            else { logger.debug(`${fnTag} Palavra ambígua ('${firstWord}') no início de frase curta, mas seguida por indicador de novo pedido ('${secondWord}'). NÃO considerando confirmação.`); return false; }
        } else { logger.debug(`${fnTag} Palavra ambígua ('${firstWord}') no início, mas frase longa (${wordCount} palavras). NÃO considerando confirmação.`); return false; }
    }
     if (firstWord !== undefined && strongConfirmations.has(firstWord)) { logger.debug(`${fnTag} Match no início da frase com confirmação forte: "${firstWord}"`); return true; }
    if (normalizedQuery.startsWith('sim ') || normalizedQuery.startsWith('ok ')) { logger.debug(`${fnTag} Match encontrado por prefixo + espaço: "${normalizedQuery}"`); return true; }

    logger.debug(`${fnTag} Nenhuma confirmação simples encontrada para: "${normalizedQuery}"`);
    return false;
}


/**
 * Lida com casos especiais como saudações e feedback.
 * v2.3 -> v2.10: Remove tratamento de BEST_TIME_KEYWORDS.
 */
async function handleSpecialCases(
    user: IUser,
    incomingText: string,
    normalizedQuery: string,
    dialogueState: IDialogueState,
    greeting: string,
    userIdStr: string
): Promise<string | null> {
    const fnTag = "[handleSpecialCases v2.10]"; // Versão atualizada
    const wordCount = normalizedQuery.split(' ').filter(Boolean).length;

    // 1. Checar Saudação Simples (MAIS RESTRITO)
    const hasGreetingKeyword = includesAnyKeyword(normalizedQuery, NORMALIZED_GREETING_KEYWORDS);
    if (hasGreetingKeyword) {
        // Verifica se há outras keywords fortes que indicariam uma intenção principal
        const hasOtherKeywords = includesAnyKeyword(normalizedQuery, NORMALIZED_STRONG_INTENT_KEYWORDS_EXCLUSION) ||
                                 includesAnyKeyword(normalizedQuery, NORMALIZED_SCRIPT_KEYWORDS); // Script é tratado separadamente
        if (wordCount <= MAX_WORDS_FOR_GREETING_CASE && !hasOtherKeywords) {
            logger.debug(`${fnTag} Tratando como saudação (curta, sem outras keywords fortes).`);
            return `${greeting} Em que posso ajudar?`;
        } else {
             logger.debug(`${fnTag} Keyword de saudação encontrada, mas ignorada (longa ou outras keywords fortes presentes).`);
        }
    }

    // 2. Checar Pergunta sobre Melhor Hora/Dia - REMOVIDO DAQUI, será tratado como intent principal

    // 3. Checar Feedback sobre a Resposta Anterior (MAIS RESTRITO)
    const isPositiveFeedbackWord = includesAnyKeyword(normalizedQuery, NORMALIZED_FEEDBACK_POSITIVE_KEYWORDS);
    const isNegativeFeedbackWord = includesAnyKeyword(normalizedQuery, NORMALIZED_FEEDBACK_NEGATIVE_KEYWORDS)
                             && !FEEDBACK_NEUTRAL_RESPONSE_WORDS.includes(normalizedQuery); // Evita "não" sozinho

    if (isPositiveFeedbackWord || isNegativeFeedbackWord) {
        logger.debug(`${fnTag} Feedback potencial detectado (Positivo: ${isPositiveFeedbackWord}, Negativo: ${isNegativeFeedbackWord}). Verificando contexto e outras keywords...`);
        const isLikelyScriptConfirmation = dialogueState.lastOfferedScriptIdea && isSimpleConfirmation(normalizedQuery);
        // Verifica se contém keywords de outras intenções principais ou referências ambíguas
        const containsOtherIntentKeyword =
            includesAnyKeyword(normalizedQuery, NORMALIZED_SCRIPT_KEYWORDS) ||
            includesAnyKeyword(normalizedQuery, NORMALIZED_CONTENT_PLAN_KEYWORDS) ||
            includesAnyKeyword(normalizedQuery, NORMALIZED_RANKING_KEYWORDS) ||
            includesAnyKeyword(normalizedQuery, NORMALIZED_REPORT_KEYWORDS) ||
            includesAnyKeyword(normalizedQuery, NORMALIZED_CONTENT_IDEAS_KEYWORDS) ||
            includesAnyKeyword(normalizedQuery, NORMALIZED_ASK_BEST_PERFORMER_KEYWORDS) || // Checa novas intents
            includesAnyKeyword(normalizedQuery, NORMALIZED_BEST_TIME_KEYWORDS) || // Checa novas intents
            containsAmbiguousReference(normalizedQuery);

        // Só trata como feedback se NÃO for uma confirmação provável de roteiro E NÃO contiver outras keywords de intenção/referência
        if (!isLikelyScriptConfirmation && !containsOtherIntentKeyword) {
             logger.info(`${fnTag} Tratando como feedback (Positivo: ${isPositiveFeedbackWord}, Negativo: ${isNegativeFeedbackWord}).`);
             updateUserFeedback(userIdStr).catch(e => logger.error(`[Intent Service] Falha ao chamar updateUserFeedback para ${userIdStr}`, e));
             if (isPositiveFeedbackWord) return selectRandom(["Que bom que gostou!", "Ótimo! Feliz em ajudar.", "Legal! Precisa de mais algo?", "Perfeito! Seguimos?"]) ?? "Legal!";
             if (isNegativeFeedbackWord) return selectRandom(["Entendido.", "Ok, obrigado pelo feedback.", "Vou registrar sua observação.", "Anotado."]) ?? "Ok.";
        } else {
            logger.debug(`${fnTag} Feedback potencial ignorado devido a contexto (oferta de roteiro/confirmação) ou presença de outras keywords/referências.`);
        }
    }
    return null; // Nenhum caso especial tratado
}

// --- Função Principal de Determinação de Intenção ---

/** Define os possíveis valores de intenção principal determinada. */
export type DeterminedIntent =
    | 'report'
    | 'content_ideas'
    | 'content_plan'
    | 'ranking_request'
    | 'script_request'
    | 'general'
    | 'ASK_BEST_PERFORMER' // Nova intenção analítica
    | 'ASK_BEST_TIME';      // Nova intenção analítica

/** Define o tipo de retorno da função principal de intenção. */
export type IntentResult =
    | { type: 'special_handled'; response: string }
    | { type: 'intent_determined'; intent: DeterminedIntent };

/**
 * Determina a intenção do usuário, considerando casos especiais, contexto,
 * e keywords explícitas, com ordem de prioridade ajustada e logging detalhado.
 * v2.10: Adiciona intents ASK_BEST_PERFORMER e ASK_BEST_TIME. Remove BEST_TIME de special cases.
 */
export async function determineIntent(
    normalizedQuery: string,
    user: IUser,
    incomingText: string,
    dialogueState: IDialogueState,
    greeting: string,
    userIdStr: string
): Promise<IntentResult> {
    const fnTag = "[determineIntent v2.10 - Novas Intenções]"; // Versão atualizada
    logger.debug(`${fnTag} Iniciando determinação para query: "${normalizedQuery}"`);
    logger.debug(`${fnTag} Estado recebido:`, dialogueState);

    // Etapa 1: Verificar casos especiais (Saudação, Feedback)
    // handleSpecialCases agora não trata mais BEST_TIME
    const specialResponse = await handleSpecialCases(user, incomingText, normalizedQuery, dialogueState, greeting, userIdStr);
    if (specialResponse !== null) {
        logger.info(`${fnTag} Caso especial tratado para user ${userIdStr}. Resposta: "${specialResponse.substring(0, 50)}..."`);
        return { type: 'special_handled', response: specialResponse };
    }

    // Etapa 2: Verificar CONTEXTO (Oferta de Roteiro, Plano Recente)
    logger.debug(`${fnTag} Verificando lógica contextual...`);
    const offerTimestamp = dialogueState.lastOfferedScriptIdea?.timestamp;
    const hasRecentOfferContext = dialogueState.lastOfferedScriptIdea;
    if (offerTimestamp && hasRecentOfferContext) {
        const offerAgeMinutes = (Date.now() - offerTimestamp) / (1000 * 60);
        logger.debug(`${fnTag} Contexto Oferta: Encontrado (Idade: ${offerAgeMinutes.toFixed(1)} min).`);
        if (offerAgeMinutes < MAX_OFFERED_SCRIPT_CONTEXT_AGE_MINUTES) {
            if (isSimpleConfirmation(normalizedQuery)) {
                 logger.info(`${fnTag} DETECÇÃO CONTEXTUAL (Oferta): Query "${normalizedQuery}" interpretada como 'script_request' pela confirmação simples.`);
                 return { type: 'intent_determined', intent: 'script_request' };
            } else {
                 logger.debug(`${fnTag} Contexto Oferta: Recente, mas query NÃO é confirmação simples.`);
            }
        } else {
            logger.debug(`${fnTag} Contexto Oferta: Ignorado (muito antigo).`);
        }
    } else {
        logger.debug(`${fnTag} Contexto Oferta: Não encontrado no estado.`);
    }

    // Verifica contexto do plano
    const planTimestamp = dialogueState.recentPlanTimestamp;
    const hasRecentPlanContext = dialogueState.recentPlanIdeas && dialogueState.recentPlanIdeas.length > 0;
    if (planTimestamp && hasRecentPlanContext) {
        const planAgeMinutes = (Date.now() - planTimestamp) / (1000 * 60);
        logger.debug(`${fnTag} Contexto Plano: Encontrado (Idade: ${planAgeMinutes.toFixed(1)} min).`);
        if (planAgeMinutes < MAX_PLAN_CONTEXT_AGE_MINUTES) {
            const isShortQuery = normalizedQuery.split(' ').length < MAX_WORDS_FOR_CONTEXTUAL_INTENT;
            // Verifica se NÃO contém keywords de outras intenções fortes (incluindo as novas)
            const hasExclusionKeyword = includesAnyKeyword(normalizedQuery, NORMALIZED_STRONG_INTENT_KEYWORDS_EXCLUSION);
            const hasScriptKeyword = includesAnyKeyword(normalizedQuery, NORMALIZED_SCRIPT_KEYWORDS);
            const hasAmbiguousRef = containsAmbiguousReference(normalizedQuery);
            logger.debug(`${fnTag} Contexto Plano: Curta? ${isShortQuery}. Exclusão? ${hasExclusionKeyword}. ScriptKW? ${hasScriptKeyword}. AmbigRef? ${hasAmbiguousRef}.`);

            if (isShortQuery && !hasExclusionKeyword && hasAmbiguousRef && hasScriptKeyword) {
                logger.info(`${fnTag} DETECÇÃO CONTEXTUAL (Plano): Query "${normalizedQuery}" interpretada como 'script_request' (ref ambígua + script kw).`);
                return { type: 'intent_determined', intent: 'script_request' };
            } else {
                 logger.debug(`${fnTag} Contexto Plano: Condições para script contextual (ref ambígua + script kw) não atendidas.`);
            }
        } else {
             logger.debug(`${fnTag} Contexto Plano: Ignorado (muito antigo).`);
        }
    } else {
        logger.debug(`${fnTag} Contexto Plano: Não encontrado no estado.`);
    }
    // --- Fim Lógica Contextual ---


    // Etapa 3: Determinar por Keywords Explícitas (ORDEM AJUSTADA com NOVAS INTENTS)
    logger.debug(`${fnTag} Procedendo com a detecção por keywords explícitas...`);
    let intent: DeterminedIntent = 'general'; // Padrão
    let matchedKeywordList: string | null = null; // Para log

    // Ordem de prioridade: Mais específicos primeiro
    if (includesAnyKeyword(normalizedQuery, NORMALIZED_CONTENT_PLAN_KEYWORDS)) {
        intent = 'content_plan';
        matchedKeywordList = 'CONTENT_PLAN';
    } else if (includesAnyKeyword(normalizedQuery, NORMALIZED_SCRIPT_KEYWORDS)) {
        // Se chegou aqui, não foi interpretado como script contextual
        intent = 'script_request';
        matchedKeywordList = 'SCRIPT';
    } else if (includesAnyKeyword(normalizedQuery, NORMALIZED_ASK_BEST_PERFORMER_KEYWORDS)) { // *** NOVO CHECK ***
        intent = 'ASK_BEST_PERFORMER';
        matchedKeywordList = 'ASK_BEST_PERFORMER';
    } else if (includesAnyKeyword(normalizedQuery, NORMALIZED_BEST_TIME_KEYWORDS)) { // *** NOVO CHECK *** (Removido de special cases)
        intent = 'ASK_BEST_TIME';
        matchedKeywordList = 'BEST_TIME';
    } else if (includesAnyKeyword(normalizedQuery, NORMALIZED_CONTENT_IDEAS_KEYWORDS)) {
        intent = 'content_ideas';
        matchedKeywordList = 'CONTENT_IDEAS';
    } else if (includesAnyKeyword(normalizedQuery, NORMALIZED_RANKING_KEYWORDS)) {
        intent = 'ranking_request';
        matchedKeywordList = 'RANKING';
    } else if (includesAnyKeyword(normalizedQuery, NORMALIZED_REPORT_KEYWORDS)) {
        // 'plano' também está em REPORT_KEYWORDS, mas CONTENT_PLAN tem prioridade maior
        intent = 'report';
        matchedKeywordList = 'REPORT';
    }

    // Log detalhado da decisão por keyword
    if (matchedKeywordList) {
        logger.debug(`${fnTag} Keyword match explícito encontrado na lista: ${matchedKeywordList}. Intenção definida para: ${intent}.`);
    } else {
         logger.debug(`${fnTag} Nenhuma keyword explícita encontrada. Intent padrão: general.`);
    }

    logger.info(`${fnTag} Intenção principal determinada final: ${intent} para user ${userIdStr}`);
    return { type: 'intent_determined', intent: intent };
}

// ====================================================
// FIM: intentService.ts - v2.10 (Novas Intenções Analíticas)
// ====================================================
