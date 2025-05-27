// @/app/lib/aiService.ts
// ATUALIZADO: vNext_BaseURLFix - Adicionada baseURL explícita na inicialização do OpenAI.
// ATUALIZADO: vNext_SummaryPrompt - Otimizado o prompt na função generateConversationSummary.
// ATUALIZADO: vNext_ExpertiseInference - Adicionada função inferUserExpertiseLevel.

import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { logger } from './logger';
import type { UserExpertiseLevel } from '@/app/models/User';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
  baseURL: 'https://api.openai.com/v1', // MODIFICADO: Adicionada esta linha
});

const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
const DEFAULT_TEMP = Number(process.env.OPENAI_TEMP) || 0.7;
const DEFAULT_MAX_TOKENS = Number(process.env.OPENAI_MAXTOK) || 500;

// Modelo e parâmetros para sumarização
const SUMMARY_MODEL = process.env.OPENAI_SUMMARY_MODEL || 'gpt-3.5-turbo';
const SUMMARY_TEMP = 0.3; 
const SUMMARY_MAX_TOKENS = 180;

// Modelo e parâmetros para inferência de nível de expertise
const EXPERTISE_INFERENCE_MODEL = process.env.OPENAI_CLASSIFICATION_MODEL || 'gpt-3.5-turbo';
const EXPERTISE_INFERENCE_TEMP = 0.1; 
const EXPERTISE_INFERENCE_MAX_TOKENS = 10;

/**
 * Faz uma chamada genérica ao ChatGPT (sem Function Calling)
 * e retorna sempre uma string (mesmo que vazio).
 *
 * @param prompt - texto a enviar
 * @param options - { temperature?, max_tokens?, model? }
 */
export async function callOpenAIForQuestion(
  prompt: string,
  options?: { temperature?: number; max_tokens?: number; model?: string }
): Promise<string> {
  const fnTag = '[aiService][callOpenAIForQuestion vBaseURLFix]'; // Adicionada tag de versão
  try {
    const model = options?.model || DEFAULT_MODEL;
    const temperature = options?.temperature ?? DEFAULT_TEMP;
    const max_tokens  = options?.max_tokens  ?? DEFAULT_MAX_TOKENS;

    logger.debug(`${fnTag} Chamando OpenAI. Modelo: ${model}, Temp: ${temperature}, MaxTokens: ${max_tokens}. Prompt (início): "${prompt.substring(0,100)}..."`);

    const completion = await openai.chat.completions.create({
      model,
      temperature,
      max_tokens,
      messages:    [{ role: 'user', content: prompt }], 
    });

    const firstChoice = completion.choices?.[0];
    const responseText = firstChoice?.message?.content?.trim() ?? '';
    logger.debug(`${fnTag} Resposta da OpenAI recebida (início): "${responseText.substring(0,100)}..."`);
    return responseText;
  } catch (error: unknown) {
    logger.error(`${fnTag} Erro ao chamar OpenAI:`, error);
    return ''; 
  }
}

/**
 * Gera um resumo conciso de um histórico de conversa usando a IA.
 * ATUALIZADO: Prompt otimizado para focar em objetivos, preferências, soluções e pendências.
 *
 * @param history Array de mensagens do histórico da conversa.
 * @param userName Nome do usuário para personalizar o prompt de resumo (opcional).
 * @returns Uma string contendo o resumo da conversa, ou string vazia em caso de erro.
 */
export async function generateConversationSummary(
  history: ChatCompletionMessageParam[],
  userName: string = 'usuário' 
): Promise<string> {
  const fnTag = '[aiService][generateConversationSummary vBaseURLFix]';

  if (!history || history.length === 0) {
    logger.warn(`${fnTag} Histórico vazio fornecido, retornando resumo vazio.`);
    return '';
  }

  const conversationText = history
    .filter(msg => msg.role === 'user' || msg.role === 'assistant') 
    .map(msg => `${msg.role === 'user' ? userName : 'Tuca'}: ${msg.content}`)
    .join('\n');

  if (conversationText.trim().length === 0) {
    logger.warn(`${fnTag} Histórico filtrado resultou em texto vazio, retornando resumo vazio.`);
    return '';
  }

  const prompt = `
Você é um assistente de sumarização altamente eficiente. Sua tarefa é ler o seguinte diálogo entre ${userName} (o usuário) e Tuca (um consultor de IA) e criar um resumo conciso em no máximo 2-3 frases.
O resumo é crucial para dar contexto a Tuca sobre o que já foi conversado e deve focar nos seguintes aspectos:

1.  **Principais tópicos e informações chave discutidas**: Quais foram os assuntos centrais?
2.  **Objetivos do usuário mencionados**: ${userName} expressou alguma meta ou o que desejava alcançar?
3.  **Preferências ou restrições expressas pelo usuário**: ${userName} indicou gostos, desgostos, formatos preferidos, ou limitações?
4.  **Soluções ou estratégias propostas por Tuca e a reação do usuário**: Tuca sugeriu algo? Como ${userName} reagiu?
5.  **Decisões ou próximos passos acordados**: Alguma ação foi definida?
6.  **Perguntas não respondidas ou tópicos pendentes**: Algo ficou em aberto para ser discutido depois?

Seja direto e capture a essência da conversa para garantir a continuidade e personalização da interação.

Diálogo:
---
${conversationText.substring(0, 3500)} ${conversationText.length > 3500 ? "\n[...diálogo truncado...]" : ""}
---

Resumo conciso da conversa (máximo 2-3 frases, priorizando os pontos acima):
  `;

  logger.debug(`${fnTag} Gerando resumo para histórico de ${history.length} mensagens. Prompt (início): "${prompt.substring(0,200)}..."`);

  try {
    const summary = await callOpenAIForQuestion(prompt, {
      model: SUMMARY_MODEL,
      temperature: SUMMARY_TEMP,
      max_tokens: SUMMARY_MAX_TOKENS,
    });

    if (summary.trim().length > 0) {
      logger.info(`${fnTag} Resumo gerado com sucesso: "${summary.substring(0,100)}..."`);
      return summary.trim();
    } else {
      logger.warn(`${fnTag} IA retornou um resumo vazio.`);
      return '';
    }
  } catch (error) {
    logger.error(`${fnTag} Erro ao gerar resumo da conversa:`, error);
    return ''; 
  }
}

/**
 * Infere o nível de expertise do usuário com base no histórico da conversa.
 *
 * @param history Array de mensagens do histórico da conversa.
 * @param userName Nome do usuário para personalizar o prompt (opcional).
 * @returns O nível de expertise inferido ('iniciante', 'intermediario', 'avancado'), ou null em caso de falha.
 */
export async function inferUserExpertiseLevel(
  history: ChatCompletionMessageParam[],
  userName: string = 'usuário'
): Promise<UserExpertiseLevel | null> { 
  const fnTag = '[aiService][inferUserExpertiseLevel vBaseURLFix]';
  
  if (!history || history.length === 0) {
    logger.warn(`${fnTag} Histórico vazio fornecido, não é possível inferir expertise.`);
    return null;
  }

  const userMessagesText = history
    .filter(msg => msg.role === 'user' && typeof msg.content === 'string' && msg.content.trim() !== '')
    .map(msg => msg.content)
    .join('\n---\n'); 

  if (userMessagesText.trim().length < 50) { 
    logger.info(`${fnTag} Conteúdo do usuário muito curto para inferência precisa de expertise.`);
    return null; 
  }

  const prompt = `
Analise as seguintes mensagens de ${userName} em uma conversa com um consultor de IA sobre marketing digital no Instagram.
Com base na linguagem utilizada, nas perguntas feitas e no aparente entendimento de termos técnicos ou estratégicos, classifique o nível de expertise de ${userName} em marketing digital e métricas do Instagram como 'iniciante', 'intermediario', ou 'avancado'.

Considere:
- 'iniciante': Faz perguntas básicas, usa pouco jargão técnico, pode parecer incerto sobre conceitos fundamentais.
- 'intermediario': Entende conceitos básicos, pode usar algum jargão, faz perguntas mais específicas sobre otimização ou estratégias.
- 'avancado': Usa jargão técnico com propriedade, discute estratégias complexas, pode questionar ou propor análises detalhadas.

Responda APENAS com UMA das seguintes palavras: iniciante, intermediario, ou avancado.

Mensagens de ${userName}:
---
${userMessagesText.substring(0, 2000)} ${userMessagesText.length > 2000 ? "\n[...mensagens truncadas...]" : ""}
---

Classificação do nível de expertise (iniciante, intermediario, ou avancado):
  `;

  logger.debug(`${fnTag} Inferindo nível de expertise para ${userName}.`);

  try {
    const response = await callOpenAIForQuestion(prompt, {
      model: EXPERTISE_INFERENCE_MODEL,
      temperature: EXPERTISE_INFERENCE_TEMP,
      max_tokens: EXPERTISE_INFERENCE_MAX_TOKENS,
    });

    const inferredLevel = response.toLowerCase().trim();

    if (inferredLevel === 'iniciante' || inferredLevel === 'intermediario' || inferredLevel === 'avancado') {
      logger.info(`${fnTag} Nível de expertise inferido para ${userName}: '${inferredLevel}'.`);
      return inferredLevel as UserExpertiseLevel;
    } else {
      logger.warn(`${fnTag} Resposta da IA para inferência de expertise inválida ('${response}'). Não foi possível inferir.`);
      return null; 
    }
  } catch (error) {
    logger.error(`${fnTag} Erro ao inferir nível de expertise para ${userName}:`, error);
    return null; 
  }
}

/** Compat para rota sendTips */
export const callOpenAIForTips = callOpenAIForQuestion;
