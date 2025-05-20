// src/app/api/whatsapp/process-response/handlerUtils.ts
import { logger } from '@/app/lib/logger';
import { normalizeText } from '@/app/lib/intentService';
import { IDialogueState } from '@/app/lib/stateService'; // Ou de onde seu tipo IDialogueState vier
import { getFunAcknowledgementPrompt } from '@/app/lib/funAcknowledgementPrompt';
import { getQuickAcknowledgementLLMResponse } from '@/app/lib/aiOrchestrator';
import { COMMON_GREETINGS_FOR_STRIPPING } from '@/app/lib/constants';
import { extractExcerpt } from '@/app/lib/utils';

/**
 * Remove saudações comuns do início de uma string de texto.
 * Utiliza uma lista pré-definida de saudações.
 * @param text O texto original do qual remover as saudações.
 * @returns O texto sem as saudações iniciais, ou o texto original se nenhuma saudação for encontrada.
 */
export function stripLeadingGreetings(text: string): string {
    let currentText = text;
    // Normaliza o input uma vez para comparações
    const normalizedInput = normalizeText(text.toLowerCase());

    for (const greeting of COMMON_GREETINGS_FOR_STRIPPING) {
        // Normaliza a saudação da lista para comparação
        const normalizedGreeting = normalizeText(greeting.toLowerCase());

        if (normalizedInput.startsWith(normalizedGreeting)) {
            // Verifica se a saudação original (case-insensitive) está no início do texto original
            // Isso é para pegar o comprimento correto da saudação no texto original
            const greetingLengthInOriginalText = greeting.length;

            if (currentText.toLowerCase().startsWith(greeting.toLowerCase())) {
                const charAfterGreeting = currentText[greetingLengthInOriginalText];

                // Verifica se a saudação é toda a string ou seguida por um espaço/pontuação
                if (greetingLengthInOriginalText === currentText.length ||
                    !charAfterGreeting || // Fim da string
                    charAfterGreeting === ' ' ||
                    charAfterGreeting === ',' ||
                    charAfterGreeting === '!' ||
                    charAfterGreeting === '.' ||
                    charAfterGreeting === '?') {

                    let textWithoutGreeting = currentText.substring(greetingLengthInOriginalText);
                    // Remove quaisquer espaços ou pontuações extras que ficaram após a remoção da saudação
                    textWithoutGreeting = textWithoutGreeting.replace(/^[\s,!.\?¿¡]+/, '').trim();

                    // Só retorna se algo foi realmente removido e a string resultante é mais curta
                    if (textWithoutGreeting.length < currentText.length || (textWithoutGreeting.length === 0 && currentText.length > 0) ) {
                        logger.debug(`[stripLeadingGreetings HUtils] Saudação "${greeting}" removida. Original: "${text.slice(0,50)}...", Resultante: "${textWithoutGreeting.slice(0,50)}..."`);
                        return textWithoutGreeting;
                    }
                }
            }
        }
    }
    // Retorna o texto original (trim para remover espaços nas bordas se nenhuma saudação foi removida)
    return text.trim();
}

/**
 * Gera uma mensagem de reconhecimento dinâmica (quebra-gelo) usando um modelo de LLM.
 * @param firstName O primeiro nome do usuário (opcional).
 * @param userQuery A consulta original do usuário.
 * @param userIdForLog O ID do usuário para logging.
 * @param dialogueState O estado atual do diálogo.
 * @returns A mensagem de reconhecimento gerada, ou null em caso de erro ou se não for gerada.
 */
export async function generateDynamicAcknowledgementInWorker(
    firstName: string | null,
    userQuery: string,
    userIdForLog: string,
    dialogueState: IDialogueState // Certifique-se que este tipo está correto
): Promise<string | null> {
    const TAG_ACK = '[HUtils][generateDynamicAck]';

    const cleanedUserQuery = stripLeadingGreetings(userQuery); // Usa a função local/importada
    const queryExcerpt = extractExcerpt(cleanedUserQuery, 35); // Usa a função de lib/utils
    const conversationSummaryForPrompt = dialogueState.conversationSummary;

    logger.info(`${TAG_ACK} User ${userIdForLog}: Gerando reconhecimento. Nome para prompt: ${firstName || '(sem nome)'}. Query Original: "${userQuery.slice(0,50)}...", Query Limpa para Excerto: "${cleanedUserQuery.slice(0,50)}...", Excerto: "${queryExcerpt}"`);
    if (conversationSummaryForPrompt) {
        logger.debug(`${TAG_ACK} User ${userIdForLog}: Usando resumo da conversa para prompt do ack: "${conversationSummaryForPrompt.substring(0,100)}..."`);
    }

    try {
        const systemPromptForAck = getFunAcknowledgementPrompt(firstName, queryExcerpt, conversationSummaryForPrompt);
        const ackMessage = await getQuickAcknowledgementLLMResponse(systemPromptForAck, userQuery, firstName || 'usuário');

        if (ackMessage) {
            logger.info(`${TAG_ACK} User ${userIdForLog}: Reconhecimento dinâmico gerado: "${ackMessage.substring(0,70)}..."`);
            return ackMessage;
        } else {
            logger.warn(`${TAG_ACK} User ${userIdForLog}: getQuickAcknowledgementLLMResponse retornou null. Sem quebra-gelo dinâmico.`);
            return null;
        }
    } catch (error) {
        logger.error(`${TAG_ACK} User ${userIdForLog}: Erro ao gerar reconhecimento dinâmico via IA:`, error);
        return null;
    }
}

/**
 * Analisa a resposta da IA para determinar se ela sugere uma ação pendente que requer confirmação do usuário.
 * @param responseText A resposta da IA.
 * @returns Um objeto indicando se uma ação é sugerida, o tipo da ação e o contexto.
 */
export function aiResponseSuggestsPendingAction(responseText: string): {
    suggests: boolean;
    actionType?: IDialogueState['lastAIQuestionType']; // Garanta que IDialogueState tenha lastAIQuestionType e pendingActionContext
    pendingActionContext?: IDialogueState['pendingActionContext']
} {
    const lowerResponse = responseText.toLowerCase();
    const generalQuestionKeywords = [
        "o que acha?", "quer que eu verifique?", "posso buscar esses dados?", "posso te ajudar com mais alguma coisa sobre isso?",
        "gostaria de prosseguir com isso?", "se quiser, posso tentar", "deseja que eu faça isso?", "quer que eu continue?"
    ];
    const endsWithQuestionMark = lowerResponse.endsWith("?");
    const includesPosso = lowerResponse.includes("posso "); // Ex: "Posso analisar seus últimos posts?"

    // Verifica se a IA está fazendo uma pergunta geral que pode implicar uma ação
    if (generalQuestionKeywords.some(kw => lowerResponse.includes(kw)) || (includesPosso && endsWithQuestionMark)) {
        // Caso específico: Pergunta sobre estatísticas por dia da semana
        if (lowerResponse.includes("dia da semana") || lowerResponse.includes("melhores dias") || lowerResponse.includes("desempenho por dia")) {
            return {
                suggests: true,
                actionType: 'confirm_fetch_day_stats', // Tipo de ação para buscar estatísticas de dias
                pendingActionContext: { originalSuggestion: responseText.slice(0, 250) } // Contexto da sugestão original
            };
        }
        // Caso específico: Clarificação para inspiração da comunidade
        if ((lowerResponse.includes("objetivo específico") || lowerResponse.includes("métrica específica") || lowerResponse.includes("focar em algo")) &&
            (lowerResponse.includes("inspiração") || lowerResponse.includes("exemplos da comunidade"))) {
            let propContext: { proposal?: string; context?: string; originalQuery?: string } = {};
            const propMatch = responseText.match(/para (?:a proposta|o tema)\s*['"]?([^'"\.,]+)['"]?/i);
            const contextMatch = responseText.match(/(?:no|para o) contexto\s*['"]?([^'"\.,]+)['"]?/i);

            if (propMatch?.[1]) propContext.proposal = propMatch[1].trim();
            if (contextMatch?.[1]) propContext.context = contextMatch[1].trim();

            return {
                suggests: true,
                actionType: 'clarify_community_inspiration_objective', // Tipo para clarificar objetivo de inspiração
                pendingActionContext: Object.keys(propContext).length > 0 ? propContext : { originalQuery: responseText.slice(0, 250) }
            };
        }
        // Caso genérico para outras ações que a IA possa sugerir
        return {
            suggests: true,
            actionType: 'confirm_another_action', // Tipo genérico para outras confirmações
            pendingActionContext: { originalSuggestion: responseText.slice(0, 250) } // Contexto da sugestão original
        };
    }
    // Se nenhuma das condições acima for atendida, a IA não está sugerindo uma ação pendente clara
    return { suggests: false };
}