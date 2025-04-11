// @/app/lib/intentService.ts - Novo Módulo (CORRIGIDO v2)

import { IUser } from "@/app/models/User"; // Assumindo que IUser está aqui
import { logger } from '@/app/lib/logger';

// --- Dependências movidas temporariamente ou que podem ir para utils.ts ---

// Simples função de seleção aleatória (pode ir para utils.ts eventualmente)
const selectRandom = <T>(arr: T[]): T | undefined => arr[Math.floor(Math.random() * arr.length)];

/**
 * Retorna uma saudação aleatória personalizada para o usuário.
 * @param userName Nome do usuário.
 * @returns String com a saudação.
 */
export const getRandomGreeting = (userName: string): string => {
    const greetings = [
        `Oi ${userName}! Como posso ajudar hoje?`,
        `Olá ${userName}! Pronto(a) para analisar seus resultados?`,
        `E aí ${userName}, tudo certo? O que manda?`
    ];
    return selectRandom(greetings) ?? `Olá ${userName}!`;
};

// Placeholder para updateUserFeedback (dependência de handleSpecialCases)
const updateUserFeedback = async (userId: string): Promise<number | null> => {
    logger.debug(`[Placeholder] updateUserFeedback chamado para ${userId}`);
    return null;
};

// Interface mínima necessária para o estado do diálogo
interface IDialogueState {
    lastInteraction?: number;
    lastGreetingSent?: number;
}

// --- Constantes de Palavras-chave ---

const POSITIVE_SENTIMENT_KEYWORDS = ["bom", "ótimo", "legal", "gostei", "excelente", "feliz", "aumentou", "cresceu", "sim", "curti", "ajudou", "obrigado", "obrigada", "aplicável", "útil", "util"];
const NEGATIVE_SENTIMENT_KEYWORDS = ["ruim", "péssimo", "triste", "problema", "difícil", "caiu", "diminuiu", "preocupado", "não", "nao", "confuso", "perdi", "piorou", "inválido", "genérico"];
const GREETING_KEYWORDS = ["oi", "olá", "ola", "tudo bem", "bom dia", "boa tarde", "boa noite", "e aí", "eae"];
const BEST_TIME_KEYWORDS = ["melhor dia", "melhor hora", "melhor horário", "qual dia", "qual hora", "qual horário", "quando postar", "frequência", "cadência"];
const JUSTIFICATION_KEYWORDS = ["por que", "porque", "pq", "justifica", "explica", "baseado em", "como assim", "detalha", "qual a lógica", "fundamento", "embase", "embasar"];
const FEEDBACK_POSITIVE_KEYWORDS = ["sim", "gostei", "útil", "util", "aplicável", "ajudou", "boa"];
const FEEDBACK_NEGATIVE_KEYWORDS = ["não", "nao"];
const FEEDBACK_NEUTRAL_RESPONSE_WORDS = ["não", "nao"];
const REQUEST_KEYWORDS = ["métrica", "dado", "ajuda", "info", "relatório", "resumo", "plano", "performance", "número", "analisa", "analise", "visão geral", "detalhado", "completo", "estratégia", "postar", "ideia", "conteúdo", "sugestão", "justifica", "explica", "detalha", "métricas", "por que", "melhor dia", "melhor hora", "formato", "proposta", "contexto"];
const CONTENT_IDEAS_KEYWORDS = [ "ideia", "conteúdo", "sugestão de post", "sugestões de post", "sugere", "sugestão", "o que postar", "inspiração", "exemplos de posts", "dicas de conteúdo", "ideias criativas" ];
const REPORT_KEYWORDS = ["relatório", "relatorio", "plano", "estratégia", "detalhado", "completo", "performance", "analisa", "analise", "visão geral"];
const CONTENT_PLAN_KEYWORDS = ["planejamento", "plano de conteudo", "agenda de posts", "calendario editorial", "o que postar essa semana", "sugestao de agenda", "me da um plano", "cria um plano"];
const RANKING_KEYWORDS = ["ranking", "top", "melhores", "piores", "classificação", "quais performam", "performam melhor", "performam pior", "lista de"];
const METRIC_KEYWORDS = ["compartilhamentos", "compartilhamento", "salvamentos", "salvos", "alcance", "visualizações", "views", "curtidas", "likes", "comentarios", "engajamento"];
const GROUPING_KEYWORDS = ["proposta", "propostas", "contexto", "contextos", "formato", "formatos", "combinacao", "combinações"];
const SCRIPT_KEYWORDS = ["roteiro", "script", "estrutura", "outline", "sequencia", "escreve pra mim", "como fazer video sobre", "estrutura de post", "roteiriza"];

// --- Função de Normalização ---

/**
 * Normaliza o texto para comparação: minúsculas, sem acentos.
 * @param text Texto a ser normalizado.
 * @returns Texto normalizado ou string vazia se a entrada for nula/vazia.
 */
export function normalizeText(text: string | undefined | null): string {
    if (!text) return "";
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

// --- Keywords Normalizadas ---

const NORMALIZED_GREETING_KEYWORDS = GREETING_KEYWORDS.map(normalizeText);
const NORMALIZED_BEST_TIME_KEYWORDS = BEST_TIME_KEYWORDS.map(normalizeText);
const NORMALIZED_FEEDBACK_POSITIVE_KEYWORDS = FEEDBACK_POSITIVE_KEYWORDS.map(normalizeText);
const NORMALIZED_FEEDBACK_NEGATIVE_KEYWORDS = FEEDBACK_NEGATIVE_KEYWORDS.map(normalizeText);
const NORMALIZED_CONTENT_IDEAS_KEYWORDS = CONTENT_IDEAS_KEYWORDS.map(normalizeText);
const NORMALIZED_REPORT_KEYWORDS = REPORT_KEYWORDS.map(normalizeText);
const NORMALIZED_CONTENT_PLAN_KEYWORDS = CONTENT_PLAN_KEYWORDS.map(normalizeText);
const NORMALIZED_RANKING_KEYWORDS = RANKING_KEYWORDS.map(normalizeText);
const NORMALIZED_SCRIPT_KEYWORDS = SCRIPT_KEYWORDS.map(normalizeText);
const NORMALIZED_REQUEST_KEYWORDS = REQUEST_KEYWORDS.map(normalizeText);

// --- Funções Auxiliares de Intenção ---

/**
 * Lida com casos especiais como saudações, feedback e perguntas sobre melhor hora.
 * Retorna a resposta direta se for um caso especial, ou null caso contrário.
 */
async function handleSpecialCases(
    user: IUser,
    incomingText: string,
    normalizedQuery: string,
    dialogueState: IDialogueState,
    greeting: string,
    userIdStr: string
): Promise<string | null> {
    // É uma saudação?
    if (NORMALIZED_GREETING_KEYWORDS.includes(normalizedQuery)) {
        return `${greeting} Em que posso ajudar?`;
    }

    // É pergunta sobre melhor hora/dia?
    if (NORMALIZED_BEST_TIME_KEYWORDS.some(kw => normalizedQuery.includes(kw))) {
        return "Sobre hora/dia: qualidade e consistência > hora exata! 😉 Tática: olhe Insights na plataforma (alcance em 48-72h). Se ainda crescendo, espere. Se estabilizou/caiu, pode postar de novo. Ajuda a não 'atropelar' post que performa!";
    }

    // É um feedback sobre a Tuca?
    const isPositiveFeedback = NORMALIZED_FEEDBACK_POSITIVE_KEYWORDS.some(p => normalizedQuery.includes(p));
    const isNegativeFeedback = NORMALIZED_FEEDBACK_NEGATIVE_KEYWORDS.some(n => normalizedQuery.includes(n) && !FEEDBACK_NEUTRAL_RESPONSE_WORDS.some(w => normalizedQuery === w));

    if (isPositiveFeedback || isNegativeFeedback) {
        updateUserFeedback(userIdStr).catch(e => logger.error(`[Intent Service] Falha ao chamar updateUserFeedback para ${userIdStr}`, e));
        if (isPositiveFeedback) return selectRandom(["Que bom que gostou!", "Ótimo! Feliz em ajudar.", "Legal! Precisa de mais algo?"]) ?? "Legal!";
        if (isNegativeFeedback) return selectRandom(["Entendido.", "Ok, obrigado pelo feedback.", "Vou registrar."]) ?? "Ok.";
    }

    return null;
}

// --- Função Principal de Determinação de Intenção ---

// <<< ADICIONADO: Tipo específico para as intenções >>>
/**
 * Define os possíveis valores de intenção principal determinada.
 */
export type DeterminedIntent = 'report' | 'content_ideas' | 'content_plan' | 'ranking_request' | 'script_request' | 'general';

/**
 * Define o tipo de retorno da função principal de intenção.
 */
export type IntentResult =
    | { type: 'special_handled'; response: string }
    // <<< ALTERADO: Usa o tipo DeterminedIntent >>>
    | { type: 'intent_determined'; intent: DeterminedIntent };

/**
 * Determina a intenção do usuário com base na query normalizada,
 * tratando casos especiais primeiro.
 */
export async function determineIntent(
    normalizedQuery: string,
    user: IUser,
    incomingText: string,
    dialogueState: IDialogueState,
    greeting: string,
    userIdStr: string
): Promise<IntentResult> {

    // 1. Verificar casos especiais primeiro
    const specialResponse = await handleSpecialCases(user, incomingText, normalizedQuery, dialogueState, greeting, userIdStr);
    if (specialResponse !== null) {
        logger.info(`[Intent Service] Caso especial tratado para user ${userIdStr}.`);
        return { type: 'special_handled', response: specialResponse };
    }

    // 2. Determinar intenção principal
    // <<< ALTERADO: Usa o tipo DeterminedIntent para a variável >>>
    let intent: DeterminedIntent = 'general'; // Padrão

    // Lógica de determinação de intenção (mantida como antes)
    if (NORMALIZED_CONTENT_PLAN_KEYWORDS.some(kw => normalizedQuery.includes(kw))) {
        intent = 'content_plan';
    } else if (NORMALIZED_RANKING_KEYWORDS.some(kw => normalizedQuery.includes(kw))) {
        intent = 'ranking_request';
    } else if (NORMALIZED_SCRIPT_KEYWORDS.some(kw => normalizedQuery.includes(kw))) {
        intent = 'script_request';
    } else if (NORMALIZED_REPORT_KEYWORDS.some(kw => normalizedQuery.includes(kw))) {
        if (!NORMALIZED_CONTENT_IDEAS_KEYWORDS.some(kw => normalizedQuery.includes(kw))) {
           intent = 'report';
        } else {
            intent = 'content_ideas';
        }
    } else if (NORMALIZED_CONTENT_IDEAS_KEYWORDS.some(kw => normalizedQuery.includes(kw))) {
        intent = 'content_ideas';
    }

    logger.info(`[Intent Service] Intenção determinada para user ${userIdStr}: ${intent}`);
    return { type: 'intent_determined', intent: intent };
}

// ====================================================
// FIM: intentService.ts (CORRIGIDO v2)
// ====================================================