// @/app/lib/intentService.ts - v2.13 (Reordena isGreeting + Correções Anteriores)

import { logger } from '@/app/lib/logger';
import { IUser } from "@/app/models/User"; // Assuming IUser is exported from User model
import { Types } from 'mongoose';

// Assuming IDialogueState is defined elsewhere or here if simple
// For now, let's assume it's imported or defined with necessary fields
interface IDialogueState {
    lastInteraction?: number;
    lastGreetingSent?: number;
    recentPlanIdeas?: { identifier: string; description: string; }[] | null;
    recentPlanTimestamp?: number;
    lastOfferedScriptIdea?: { aiGeneratedIdeaDescription: string; originalSource: any; timestamp: number; } | null; // Added originalSource back based on usage
}

// --- Tipos e Constantes ---
export type DeterminedIntent =
    | 'script_request'
    | 'content_plan'
    | 'ranking_request'
    | 'general' // Default/Fallback
    | 'report' // Explicit report request
    | 'content_ideas' // Explicit idea request
    | 'greeting' // Simple greeting
    | 'clarification_follow_up' // User responding to a clarification request
    | 'proactive_script_accept' // User accepts a proactive script offer
    | 'proactive_script_reject' // User rejects or ignores proactive offer
    | 'ASK_BEST_PERFORMER' // New: Ask about best performing content type/proposal/context
    | 'ASK_BEST_TIME';     // New: Ask about best time/day to post

// Represents the result of intent determination
export type IntentResult =
    | { type: 'intent_determined'; intent: DeterminedIntent }
    | { type: 'special_handled'; response: string }; // For immediate responses (greeting, empty)

// --- Funções Utilitárias ---
const selectRandom = <T>(arr: T[]): T | undefined => { if (arr.length === 0) return undefined; return arr[Math.floor(Math.random() * arr.length)]; };
export const getRandomGreeting = (userName: string): string => { const greetings = [ `Oi ${userName}! Como posso ajudar hoje?`, `Olá ${userName}! Pronto(a) para analisar seus resultados?`, `E aí ${userName}, tudo certo? O que manda?` ]; return selectRandom(greetings) ?? `Olá ${userName}!`; };
const updateUserFeedback = async (userId: string): Promise<number | null> => { logger.debug(`[Placeholder] updateUserFeedback chamado para ${userId}`); return null; };

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
const RANKING_KEYWORDS = ["ranking", "rank", "melhores", "piores", "top", "quais sao os", "lista de"];
const SCRIPT_KEYWORDS = ["roteiro", "script", "estrutura", "outline", "sequencia", "escreve pra mim", "como fazer video sobre", "estrutura de post", "roteiriza"];
const AMBIGUOUS_REFERENCE_KEYWORDS = [ "primeiro", "primeira", "segundo", "segunda", "terceiro", "terceira", "quarto", "quarta", "quinto", "quinta", "1", "2", "3", "4", "5", "segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo", "esse", "essa", "este", "esta", "aquele", "aquela", "gostei", "quero", "faz", "fazer", "pode ser", "manda", "o ultimo", "a ultima", "ultimo", "ultima" ];
const AMBIGUOUS_REFERENCE_REGEX = /\b(gostei d[oa]|quero [oa]|faz [oa]|fazer [oa]|pode ser [oa]|mand[ae] [oa])\s+(.+)/i;

// *** NOVAS KEYWORDS ***
const ASK_BEST_PERFORMER_KEYWORDS = ["qual tipo", "qual conteudo", "qual proposta", "qual contexto", "gera mais", "melhor desempenho", "maior desempenho", "recordista em", "performam melhor", "quais dao mais", "o que da mais"];
const BEST_TIME_KEYWORDS = ["melhor dia", "melhor hora", "melhor horario", "qual dia", "qual hora", "qual horario", "quando postar", "frequencia", "cadencia"];

// Lista de exclusão atualizada para incluir novas keywords se necessário
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

/** Checks for simple rejections (no, etc.). */
function isSimpleRejection(normalizedText: string): boolean {
    const rejections = ["nao", "n", "agora nao", "depois", "talvez depois", "outra hora", "deixa pra la"];
    return rejections.includes(normalizedText);
}

/** Checks for requests for content ideas. */
function isAskingForIdeas(normalizedText: string): boolean {
    const ideaKeywords = ["ideia", "ideias", "sugestao", "sugestoes", "sugere", "inspiracao", "pauta", "pautas"];
    const ideaPatterns = [
        /me da (uma |umas )?(ideia|sugestao|inspiracao|pauta)/,
        /preciso de (ideia|sugestao|inspiracao|pauta)/,
        /tem (ideia|sugestao|inspiracao|pauta)s? para/,
        /quais (ideia|sugestao|inspiracao|pauta)s? voce tem/,
        /gera (ideia|sugestao|pauta)s?/,
    ];
    return ideaKeywords.some(kw => normalizedText.includes(kw)) || ideaPatterns.some(p => p.test(normalizedText));
}

/** Checks for requests for reports/summaries. */
function isAskingForReport(normalizedText: string): boolean {
    const reportKeywords = ["relatorio", "resumo", "desempenho", "performance", "analise", "como fui", "como estou indo"];
    const reportPatterns = [
        /me da o (relatorio|resumo|desempenho)/,
        /gera um (relatorio|resumo)/,
        /como foi meu (desempenho|performance)/,
        /faz uma analise/,
    ];
    return reportKeywords.some(kw => normalizedText.includes(kw)) || reportPatterns.some(p => p.test(normalizedText));
}

/** Checks for requests for rankings. */
function isAskingForRanking(normalizedText: string): boolean {
    const rankingKeywords = ["ranking", "rank", "melhores", "piores", "top", "quais sao os", "lista de"];
    const rankingPatterns = [
        /(?:me )?mostra o ranking/,
        /quais (foram|sao) os melhores/,
        /quais (foram|sao) os piores/,
        /faz um top \d+/,
        /lista (os|as) (melhores|piores)/,
    ];
    // Avoid matching "melhores dias" which should be ASK_BEST_TIME
    if (normalizedText.includes("melhores dias")) {
        return false;
    }
    return rankingKeywords.some(kw => normalizedText.includes(kw)) || rankingPatterns.some(p => p.test(normalizedText));
}

/** Checks for requests for content plans. */
function isAskingForPlan(normalizedText: string): boolean {
    const planKeywords = ["plano", "planejamento", "calendario", "agenda", "cronograma", "conteudo", "postagens"];
    const planPatterns = [
        /(?:me )?da (o|um) (plano|planejamento|calendario|cronograma)/,
        /cria (um )?(plano|planejamento|calendario|cronograma)/,
        /preciso de (um )?(plano|planejamento)/,
        /sugere? (um )?(plano|planejamento)/,
        /organiza (minhas postagens|meu conteudo)/,
        /planejamento (semanal|de conteudo)/,
    ];
    // Avoid triggering if just asking for "ideas" or "report" which might contain "conteudo"
    if (isAskingForIdeas(normalizedText) || isAskingForReport(normalizedText)) {
        return false;
    }
    return planKeywords.some(kw => normalizedText.includes(kw)) || planPatterns.some(p => p.test(normalizedText));
}

/** Checks for requests for scripts/outlines. */
function isAskingForScript(normalizedText: string): boolean {
    const scriptKeywords = ["roteiro", "script", "estrutura", "outline", "sequencia", "escreve pra mim", "roteiriza"];
    const scriptPatterns = [
        /(?:me )?da (o|um) (roteiro|script|outline|estrutura)/,
        /cria (um )?(roteiro|script|outline|estrutura)/,
        /faz (um )?(roteiro|script|outline)/,
        /preciso de (um )?(roteiro|script)/,
        /como fazer (um )?video sobre/,
        /estrutura de post sobre/,
        /(?:me )?ajuda a roteirizar/,
    ];
    return scriptKeywords.some(kw => normalizedText.includes(kw)) || scriptPatterns.some(p => p.test(normalizedText));
}

/** Checks for questions about best performing content. */
function isAskingBestPerformer(normalizedText: string): boolean {
    const patterns = [
        /qual (tipo de )?conteudo (gera|da|tem|teve) mais/,
        /qual (proposta|contexto) (gera|da|tem|teve) mais/,
        /o que (gera|da|tem|teve) mais (\w+)/,
        /(?:qual|quais) (proposta|contexto|conteudo|post) (performou|performaram|foi|foram) melhor/,
        /(?:qual|quais) (dao|da) mais (\w+)/,
        /melhor desempenho em/,
        /maior desempenho em/,
        /recordista em/,
    ];
    return patterns.some(p => p.test(normalizedText));
}

/** Checks for questions about the best time/day to post. */
// <<< LÓGICA ATUALIZADA (v2.11) >>> Prioriza "melhor dia" e "quando postar"
function isAskingBestTime(normalizedText: string): boolean {
    const specificDayPatterns = [
        /qual (o )?melhor dia (da semana )?para postar/,
        /em qual dia devo postar/,
        /quando (?:e|seria) melhor postar (?:sobre|o|a)/, // "quando é melhor postar sobre vendas"
        /melhores dias para (?:a|o) proposta/, // "melhores dias para a proposta X"
    ];
    const generalTimePatterns = [
        /qual (o )?melhor horario/, // Less common, might need specific handling later
        /quando postar (?:sobre|o|a)/, // More general "when to post"
    ];

    // Prioritize specific day questions
    if (specificDayPatterns.some(p => p.test(normalizedText))) {
        return true;
    }
    // Check general time questions only if not asking for ranking/best performer
    if (!isAskingForRanking(normalizedText) && !isAskingBestPerformer(normalizedText)) {
        if (generalTimePatterns.some(p => p.test(normalizedText))) {
            return true;
        }
    }
    return false;
}


/**
 * Lida com casos especiais como saudações e feedback.
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
    // <<< DEFINIÇÃO MOVIDA PARA CÁ (v2.13) >>>
    function isGreeting(normalizedText: string): boolean {
        const greetings = ["oi", "ola", "bom dia", "boa tarde", "boa noite", "e ai", "tudo bem", "tudo bom", "como vai"];
        // Check if the normalized text *is* exactly one of the greetings
        return greetings.includes(normalizedText);
    }
    // <<< FIM DA DEFINIÇÃO MOVIDA >>>

    const hasGreetingKeyword = includesAnyKeyword(normalizedQuery, NORMALIZED_GREETING_KEYWORDS);
    if (hasGreetingKeyword) {
        // Verifica se há outras keywords fortes que indicariam uma intenção principal
        const hasOtherKeywords = includesAnyKeyword(normalizedQuery, NORMALIZED_STRONG_INTENT_KEYWORDS_EXCLUSION) ||
                                 includesAnyKeyword(normalizedQuery, NORMALIZED_SCRIPT_KEYWORDS); // Script é tratado separadamente
        if (wordCount <= MAX_WORDS_FOR_GREETING_CASE && !hasOtherKeywords && isGreeting(normalizedQuery)) { // Usa a função local
            logger.debug(`${fnTag} Tratando como saudação (curta, sem outras keywords fortes).`);
            return `${greeting} Em que posso ajudar?`;
        } else {
             logger.debug(`${fnTag} Keyword de saudação encontrada, mas ignorada (longa ou outras keywords fortes presentes ou não é apenas saudação).`);
        }
    }

    // 2. Checar Feedback sobre a Resposta Anterior (MAIS RESTRITO)
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

// <<< DEFINIÇÃO MOVIDA PARA CÁ (v2.13) >>>
/** Checks for simple greetings. */
function isGreeting(normalizedText: string): boolean {
    const greetings = ["oi", "ola", "bom dia", "boa tarde", "boa noite", "e ai", "tudo bem", "tudo bom", "como vai"];
    // Check if the normalized text *is* exactly one of the greetings
    return greetings.includes(normalizedText);
}
// <<< FIM DA DEFINIÇÃO MOVIDA >>>

/**
 * Determines the user's intent based on text, context, and dialogue state.
 * v2.13: Moved isGreeting definition locally.
 */
export async function determineIntent(
    normalizedText: string,
    user: IUser,
    originalText: string, // Keep original text for potential future use (e.g., context extraction)
    dialogueState: IDialogueState,
    greeting: string, // Pass greeting for context
    userIdStr: string // For logging
): Promise<IntentResult> {
    const fnTag = "[determineIntent v2.13 - Reorder Fix]"; // Versão atualizada
    logger.debug(`${fnTag} Iniciando determinação para query: "${normalizedText}"`);
    logger.debug(`${fnTag} Estado recebido:`, dialogueState);

    // 1. Handle Empty Input (Should ideally be caught before calling this)
    if (!normalizedText) {
        logger.warn(`${fnTag} Texto normalizado vazio.`);
        // Respond immediately if possible, or return a specific intent/error
        return { type: 'special_handled', response: `${greeting} Não entendi o que você quis dizer. Pode tentar de novo?` };
    }

    // 2. Check for Contextual Follow-ups (based on dialogue state)
    logger.debug(`${fnTag} Verificando lógica contextual...`);
    // 2a. Check if AI offered a script proactively
    const offeredContext = dialogueState.lastOfferedScriptIdea;
    if (offeredContext?.timestamp && (Date.now() - offeredContext.timestamp) < (MAX_OFFERED_SCRIPT_CONTEXT_AGE_MINUTES * 60 * 1000)) {
        logger.debug(`${fnTag} Contexto Oferta: Encontrado. Desc: "${offeredContext.aiGeneratedIdeaDescription.substring(0,30)}..."`);
        if (isSimpleConfirmation(normalizedText)) {
            logger.info(`${fnTag} Intenção contextual: proactive_script_accept`);
            return { type: 'intent_determined', intent: 'script_request' }; // Treat acceptance as a script request
        }
        if (isSimpleRejection(normalizedText)) {
            logger.info(`${fnTag} Intenção contextual: proactive_script_reject`);
            // Clear the offer state? Maybe handled in consultantService after rejection response.
            return { type: 'intent_determined', intent: 'general' }; // Treat rejection as general for now
        }
        // If not a clear accept/reject, assume the user is asking something else, ignore the offer context for now.
        logger.debug(`${fnTag} Contexto de oferta presente, mas input não é confirmação/rejeição clara.`);
    } else {
         logger.debug(`${fnTag} Contexto Oferta: Não encontrado no estado.`);
    }

    // 2b. Check if AI presented plan items and user might be selecting one for a script
    const planContext = dialogueState.recentPlanIdeas;
    if (planContext && planContext.length > 0 && dialogueState.recentPlanTimestamp && (Date.now() - dialogueState.recentPlanTimestamp) < (MAX_PLAN_CONTEXT_AGE_MINUTES * 60 * 1000)) {
        logger.debug(`${fnTag} Contexto Plano: Encontrado (${planContext.length} itens). Verificando se input corresponde a item.`);
        // Check if the user input clearly refers to one of the plan items (e.g., "roteiro para a 2", "faz o script da [identifier]")
        const planFollowUpKeywords = ["roteiro para", "script da", "faz o", "detalha a", "escolho a", "quero a ideia"];
        // --- CORREÇÃO APLICADA AQUI (v2.12) ---
        const firstWord = normalizedText.split(' ')[0]; // Get the first word
        // Check if firstWord is defined before testing regex
        const isNumericOrOrdinal = firstWord !== undefined && /^(?:[1-9]|primeir[ao]|segund[ao]|terceir[ao]|quart[ao]|quint[ao])$/.test(firstWord);
        // --- FIM DA CORREÇÃO ---

        if (planFollowUpKeywords.some(kw => normalizedText.includes(kw)) || isNumericOrOrdinal) { // Use the boolean result
            logger.info(`${fnTag} Intenção contextual: Possível seleção de item do plano para roteiro -> script_request`);
            return { type: 'intent_determined', intent: 'script_request' };
        } else {
            logger.debug(`${fnTag} Contexto Plano: Condições para script contextual não atendidas.`);
        }
    } else {
         logger.debug(`${fnTag} Contexto Plano: Não encontrado no estado.`);
    }
    // --- Fim Lógica Contextual ---


    // 3. Explicit Keyword/Pattern Matching (Order matters!)
    logger.debug(`${fnTag} Procedendo com a detecção por keywords explícitas...`);
    let intent: DeterminedIntent = 'general'; // Padrão
    let matchedKeywordList: string | null = null; // Para log

    // Ordem de prioridade: Mais específicos primeiro
    if (isAskingBestTime(normalizedText)) { // Prioritize this check
        intent = 'ASK_BEST_TIME';
        matchedKeywordList = 'BEST_TIME';
    } else if (includesAnyKeyword(normalizedText, NORMALIZED_CONTENT_PLAN_KEYWORDS)) {
        intent = 'content_plan';
        matchedKeywordList = 'CONTENT_PLAN';
    } else if (includesAnyKeyword(normalizedText, NORMALIZED_SCRIPT_KEYWORDS)) {
        // Se chegou aqui, não foi interpretado como script contextual
        intent = 'script_request';
        matchedKeywordList = 'SCRIPT';
    } else if (includesAnyKeyword(normalizedText, NORMALIZED_ASK_BEST_PERFORMER_KEYWORDS)) {
        intent = 'ASK_BEST_PERFORMER';
        matchedKeywordList = 'ASK_BEST_PERFORMER';
    } else if (includesAnyKeyword(normalizedText, NORMALIZED_CONTENT_IDEAS_KEYWORDS)) {
        intent = 'content_ideas';
        matchedKeywordList = 'CONTENT_IDEAS';
    } else if (isAskingForRanking(normalizedText)) { // Check ranking after specific day questions
        intent = 'ranking_request';
        matchedKeywordList = 'RANKING';
    } else if (includesAnyKeyword(normalizedText, NORMALIZED_REPORT_KEYWORDS)) {
        // 'plano' também está em REPORT_KEYWORDS, mas CONTENT_PLAN tem prioridade maior
        intent = 'report';
        matchedKeywordList = 'REPORT';
    } else if (isGreeting(normalizedText)) { // <<< CHAMADA CORRIGIDA (v2.13 - usa função local)
        // Handle greeting last among explicit keywords, as it was handled by special cases if simple enough
        logger.debug(`${fnTag} Keyword match explícito encontrado na lista: GREETING (tratado como general).`);
        intent = 'general'; // Treat complex greetings as general query
        matchedKeywordList = 'GREETING (Complex)';
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
// FIM: intentService.ts - v2.13 (Reordena isGreeting)
// ====================================================
