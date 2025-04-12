// @/app/lib/intentService.ts - v2.1 (Otimizado para Clareza)

import { IUser } from "@/app/models/User"; // Assumindo que IUser está aqui
import { logger } from '@/app/lib/logger';

// --- Funções Utilitárias ---
// SUGESTÃO: Mover 'selectRandom' e 'getRandomGreeting' para um arquivo utils.ts futuramente.

/**
 * Seleciona um elemento aleatório de um array.
 * @param arr Array de onde selecionar.
 * @returns Elemento aleatório ou undefined se o array for vazio.
 */
const selectRandom = <T>(arr: T[]): T | undefined => {
    if (arr.length === 0) return undefined;
    return arr[Math.floor(Math.random() * arr.length)];
}

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
        // Adicione mais variações se desejar
    ];
    // Usa 'selectRandom' e fornece um fallback caso algo dê errado (array vazio, etc.)
    return selectRandom(greetings) ?? `Olá ${userName}!`;
};

// Placeholder para updateUserFeedback (dependência de handleSpecialCases)
// TODO: Implementar a lógica real de feedback ou remover se não for usado.
const updateUserFeedback = async (userId: string): Promise<number | null> => {
    logger.debug(`[Placeholder] updateUserFeedback chamado para ${userId}`);
    // Exemplo: poderia interagir com uma API ou banco de dados aqui.
    return null;
};

// Interface mínima necessária para o estado do diálogo
interface IDialogueState {
    lastInteraction?: number;
    lastGreetingSent?: number;
    // Pode adicionar outros campos de estado relevantes aqui, se necessário.
}

// --- Constantes de Palavras-chave (Keywords) ---
// Comentários adicionados para clareza

// Keywords para detectar intenções gerais de interação ou estado
const POSITIVE_SENTIMENT_KEYWORDS = ["bom", "ótimo", "legal", "gostei", "excelente", "feliz", "aumentou", "cresceu", "sim", "curti", "ajudou", "obrigado", "obrigada", "aplicável", "útil", "util"];
const NEGATIVE_SENTIMENT_KEYWORDS = ["ruim", "péssimo", "triste", "problema", "difícil", "caiu", "diminuiu", "preocupado", "não", "nao", "confuso", "perdi", "piorou", "inválido", "genérico"];
const GREETING_KEYWORDS = ["oi", "olá", "ola", "tudo bem", "bom dia", "boa tarde", "boa noite", "e aí", "eae"]; // Saudações simples

// Keywords para casos especiais tratados diretamente
const BEST_TIME_KEYWORDS = ["melhor dia", "melhor hora", "melhor horário", "qual dia", "qual hora", "qual horário", "quando postar", "frequência", "cadência"]; // Perguntas sobre timing/frequência
const JUSTIFICATION_KEYWORDS = ["por que", "porque", "pq", "justifica", "explica", "baseado em", "como assim", "detalha", "qual a lógica", "fundamento", "embase", "embasar"]; // Pedidos de explicação (atualmente não tratado como caso especial)
const FEEDBACK_POSITIVE_KEYWORDS = ["sim", "gostei", "útil", "util", "aplicável", "ajudou", "boa"]; // Feedback positivo sobre a Tuca/resposta
const FEEDBACK_NEGATIVE_KEYWORDS = ["não", "nao"]; // Feedback negativo (genérico)
const FEEDBACK_NEUTRAL_RESPONSE_WORDS = ["não", "nao"]; // Palavras que, isoladas, podem ser respostas neutras e não feedback negativo explícito

// Keywords para determinar a intenção principal do usuário
const REQUEST_KEYWORDS = ["métrica", "dado", "ajuda", "info", "relatório", "resumo", "plano", "performance", "número", "analisa", "analise", "visão geral", "detalhado", "completo", "estratégia", "postar", "ideia", "conteúdo", "sugestão", "justifica", "explica", "detalha", "métricas", "por que", "melhor dia", "melhor hora", "formato", "proposta", "contexto"]; // Keywords gerais de solicitação
const CONTENT_IDEAS_KEYWORDS = [ "ideia", "conteúdo", "sugestão de post", "sugestões de post", "sugere", "sugestão", "o que postar", "inspiração", "exemplos de posts", "dicas de conteúdo", "ideias criativas" ]; // Intenção: pedir ideias
const REPORT_KEYWORDS = ["relatório", "relatorio", "plano", "estratégia", "detalhado", "completo", "performance", "analisa", "analise", "visão geral"]; // Intenção: pedir análise/relatório
const CONTENT_PLAN_KEYWORDS = ["planejamento", "plano de conteudo", "agenda de posts", "calendario editorial", "o que postar essa semana", "sugestao de agenda", "me da um plano", "cria um plano"]; // Intenção: pedir plano de conteúdo
const RANKING_KEYWORDS = ["ranking", "top", "melhores", "piores", "classificação", "quais performam", "performam melhor", "performam pior", "lista de"]; // Intenção: pedir ranking
const METRIC_KEYWORDS = ["compartilhamentos", "compartilhamento", "salvamentos", "salvos", "alcance", "visualizações", "views", "curtidas", "likes", "comentarios", "engajamento"]; // Nomes de métricas (informativo, pode ser usado para refinar intenção)
const GROUPING_KEYWORDS = ["proposta", "propostas", "contexto", "contextos", "formato", "formatos", "combinacao", "combinações"]; // Nomes de agrupamentos (informativo)
const SCRIPT_KEYWORDS = ["roteiro", "script", "estrutura", "outline", "sequencia", "escreve pra mim", "como fazer video sobre", "estrutura de post", "roteiriza"]; // Intenção: pedir roteiro

// --- Função de Normalização ---

/**
 * Normaliza o texto para comparação: minúsculas, sem acentos.
 * @param text Texto a ser normalizado.
 * @returns Texto normalizado ou string vazia se a entrada for nula/vazia.
 */
export function normalizeText(text: string | undefined | null): string {
    if (!text) return "";
    try {
        return text
            .toLowerCase()
            .normalize("NFD") // Decompõe caracteres acentuados (ex: 'é' -> 'e' + '´')
            .replace(/[\u0300-\u036f]/g, ""); // Remove os diacríticos (acentos)
    } catch (error) {
        logger.warn(`[normalizeText] Erro ao normalizar texto: "${text}"`, error);
        return text.toLowerCase(); // Retorna ao menos em minúsculas em caso de erro
    }
}

// --- Keywords Normalizadas (Pré-calculadas para eficiência) ---
// Manter essas listas pré-calculadas evita reprocessamento a cada chamada.
const NORMALIZED_GREETING_KEYWORDS = GREETING_KEYWORDS.map(normalizeText);
const NORMALIZED_BEST_TIME_KEYWORDS = BEST_TIME_KEYWORDS.map(normalizeText);
const NORMALIZED_FEEDBACK_POSITIVE_KEYWORDS = FEEDBACK_POSITIVE_KEYWORDS.map(normalizeText);
const NORMALIZED_FEEDBACK_NEGATIVE_KEYWORDS = FEEDBACK_NEGATIVE_KEYWORDS.map(normalizeText);
const NORMALIZED_CONTENT_IDEAS_KEYWORDS = CONTENT_IDEAS_KEYWORDS.map(normalizeText);
const NORMALIZED_REPORT_KEYWORDS = REPORT_KEYWORDS.map(normalizeText);
const NORMALIZED_CONTENT_PLAN_KEYWORDS = CONTENT_PLAN_KEYWORDS.map(normalizeText);
const NORMALIZED_RANKING_KEYWORDS = RANKING_KEYWORDS.map(normalizeText);
const NORMALIZED_SCRIPT_KEYWORDS = SCRIPT_KEYWORDS.map(normalizeText);
const NORMALIZED_REQUEST_KEYWORDS = REQUEST_KEYWORDS.map(normalizeText); // Pode não ser usado diretamente na lógica atual, mas mantido para referência

// --- Funções Auxiliares de Intenção ---

/**
 * Verifica se alguma das keywords está presente no texto normalizado.
 * Otimização: Usa um loop `for` para retornar `true` assim que encontrar a primeira correspondência.
 * @param normalizedText Texto já normalizado onde procurar.
 * @param normalizedKeywords Array de keywords já normalizadas para procurar.
 * @returns `true` se alguma keyword for encontrada, `false` caso contrário.
 */
function includesAnyKeyword(normalizedText: string, normalizedKeywords: ReadonlyArray<string>): boolean {
    for (const keyword of normalizedKeywords) {
        // Verifica se a keyword não está vazia para evitar matches indesejados
        if (keyword && normalizedText.includes(keyword)) {
            return true;
        }
    }
    return false;
}


/**
 * Lida com casos especiais como saudações, feedback e perguntas sobre melhor hora.
 * Retorna a resposta direta se for um caso especial, ou null caso contrário.
 */
async function handleSpecialCases(
    user: IUser,
    incomingText: string, // Mantido para contexto futuro, se necessário
    normalizedQuery: string,
    dialogueState: IDialogueState, // Mantido para contexto futuro
    greeting: string,
    userIdStr: string
): Promise<string | null> {

    // 1. Checar Saudação Simples
    // Otimização: Usa `includesAnyKeyword`
    if (includesAnyKeyword(normalizedQuery, NORMALIZED_GREETING_KEYWORDS)) {
        // Poderia verificar 'dialogueState.lastGreetingSent' aqui para evitar saudações repetitivas,
        // mas a lógica atual parece retornar a saudação seguida de "Em que posso ajudar?".
        return `${greeting} Em que posso ajudar?`;
    }

    // 2. Checar Pergunta sobre Melhor Hora/Dia
    // Otimização: Usa `includesAnyKeyword`
    if (includesAnyKeyword(normalizedQuery, NORMALIZED_BEST_TIME_KEYWORDS)) {
        // Resposta padrão informativa sobre timing de posts.
        return "Sobre hora/dia: qualidade e consistência > hora exata! 😉 Tática: olhe Insights na plataforma (alcance em 48-72h). Se ainda crescendo, espere. Se estabilizou/caiu, pode postar de novo. Ajuda a não 'atropelar' post que performa!";
    }

    // 3. Checar Feedback sobre a Tuca/Resposta Anterior
    // Otimização: Usa `includesAnyKeyword`
    const isPositiveFeedback = includesAnyKeyword(normalizedQuery, NORMALIZED_FEEDBACK_POSITIVE_KEYWORDS);
    // Lógica para feedback negativo: precisa conter keyword negativa E NÃO ser apenas uma palavra neutra como "não"
    const isNegativeFeedback = includesAnyKeyword(normalizedQuery, NORMALIZED_FEEDBACK_NEGATIVE_KEYWORDS)
                             && !FEEDBACK_NEUTRAL_RESPONSE_WORDS.includes(normalizedQuery);

    if (isPositiveFeedback || isNegativeFeedback) {
        // Chama a função (atualmente placeholder) para registrar o feedback de forma assíncrona.
        updateUserFeedback(userIdStr).catch(e => logger.error(`[Intent Service] Falha ao chamar updateUserFeedback para ${userIdStr}`, e));

        // Retorna uma resposta aleatória apropriada para o tipo de feedback.
        if (isPositiveFeedback) {
            return selectRandom(["Que bom que gostou!", "Ótimo! Feliz em ajudar.", "Legal! Precisa de mais algo?", "Perfeito! Seguimos?"]) ?? "Legal!";
        }
        if (isNegativeFeedback) {
            return selectRandom(["Entendido.", "Ok, obrigado pelo feedback.", "Vou registrar sua observação.", "Anotado."]) ?? "Ok.";
        }
    }

    // Se nenhum caso especial foi tratado, retorna null para continuar a determinação da intenção principal.
    return null;
}

// --- Função Principal de Determinação de Intenção ---

/**
 * Define os possíveis valores de intenção principal determinada.
 */
export type DeterminedIntent = 'report' | 'content_ideas' | 'content_plan' | 'ranking_request' | 'script_request' | 'general';

/**
 * Define o tipo de retorno da função principal de intenção.
 */
export type IntentResult =
    | { type: 'special_handled'; response: string }
    | { type: 'intent_determined'; intent: DeterminedIntent };

/**
 * Determina a intenção do usuário com base na query normalizada,
 * tratando casos especiais primeiro e seguindo uma ordem de prioridade para os demais.
 */
export async function determineIntent(
    normalizedQuery: string,
    user: IUser,
    incomingText: string,
    dialogueState: IDialogueState,
    greeting: string,
    userIdStr: string
): Promise<IntentResult> {

    // Etapa 1: Verificar e tratar casos especiais que têm respostas diretas.
    const specialResponse = await handleSpecialCases(user, incomingText, normalizedQuery, dialogueState, greeting, userIdStr);
    if (specialResponse !== null) {
        logger.info(`[Intent Service] Caso especial tratado para user ${userIdStr}. Resposta direta.`);
        return { type: 'special_handled', response: specialResponse };
    }

    // Etapa 2: Se não for um caso especial, determinar a intenção principal com base nas keywords.
    // A ordem dos 'if/else if' define a prioridade (intenções mais específicas primeiro).
    // Otimização: Usa `includesAnyKeyword` para as checagens.
    let intent: DeterminedIntent = 'general'; // Intenção padrão se nenhuma outra for detectada.

    if (includesAnyKeyword(normalizedQuery, NORMALIZED_CONTENT_PLAN_KEYWORDS)) {
        // Intenção mais específica: Usuário pede um plano de conteúdo.
        intent = 'content_plan';
    } else if (includesAnyKeyword(normalizedQuery, NORMALIZED_RANKING_KEYWORDS)) {
        // Intenção específica: Usuário pede um ranking.
        intent = 'ranking_request';
    } else if (includesAnyKeyword(normalizedQuery, NORMALIZED_SCRIPT_KEYWORDS)) {
        // Intenção específica: Usuário pede um roteiro/script.
        intent = 'script_request';
    } else if (includesAnyKeyword(normalizedQuery, NORMALIZED_REPORT_KEYWORDS)) {
        // Intenção: Usuário pede algum tipo de relatório/análise/visão geral.
        // Refinamento: Se também pedir ideias, classifica como 'content_ideas', senão 'report'.
        if (!includesAnyKeyword(normalizedQuery, NORMALIZED_CONTENT_IDEAS_KEYWORDS)) {
           intent = 'report'; // Foco na análise/relatório.
        } else {
            intent = 'content_ideas'; // Pediu relatório/análise E ideias -> prioriza ideias.
        }
    } else if (includesAnyKeyword(normalizedQuery, NORMALIZED_CONTENT_IDEAS_KEYWORDS)) {
        // Intenção: Usuário pede ideias de conteúdo (mesmo sem mencionar relatório).
        intent = 'content_ideas';
    }
    // NOTA: Se nenhuma das keywords acima for encontrada, a intenção permanece 'general'.
    // A intenção 'general' pode abranger perguntas abertas, dúvidas, pedidos de explicação não específicos, etc.

    logger.info(`[Intent Service] Intenção principal determinada para user ${userIdStr}: ${intent}`);
    return { type: 'intent_determined', intent: intent };
}

// ====================================================
// FIM: intentService.ts (v2.1 - Otimizado para Clareza)
// ====================================================