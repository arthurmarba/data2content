// @/app/lib/aiService.ts

import OpenAI from 'openai';
import type { CreateChatCompletionRequestMessage } from 'openai/resources/chat/completions';
import { logger } from './logger';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/**
 * Faz uma chamada genérica ao ChatGPT (sem Function Calling)
 * e retorna sempre uma string (mesmo que vazio).
 *
 * @param prompt - texto a enviar
 * @param options - { temperature?, max_tokens? }
 */
export async function callOpenAIForQuestion(
  prompt: string,
  options?: { temperature?: number; max_tokens?: number }
): Promise<string> {
  try {
    const temperature = (options?.temperature ?? Number(process.env.OPENAI_TEMP)) || 0.7;
    const max_tokens  = (options?.max_tokens  ?? Number(process.env.OPENAI_MAXTOK)) || 500;

    const completion = await openai.chat.completions.create({
      model:       process.env.OPENAI_MODEL   || 'gpt-3.5-turbo',
      temperature,
      max_tokens,
      messages:    [{ role: 'user', content: prompt }] as CreateChatCompletionRequestMessage[],
    });

    const firstChoice = completion.choices?.[0];
    return firstChoice?.message?.content ?? '';
  } catch (error: unknown) {
    logger.error('[aiService] callOpenAIForQuestion erro', error);
    return '';
  }
}

/** Compat para rota sendTips */
export const callOpenAIForTips = callOpenAIForQuestion;
