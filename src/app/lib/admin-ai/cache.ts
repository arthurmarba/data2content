/**
 * @fileoverview Módulo de gerenciamento de cache com Redis.
 * @version 2.0.0
 * @description Abstrai toda a lógica de interação com o Redis,
 * incluindo checagem de conexão, timeouts e operações de get/set.
 *
 * ## Melhorias na Versão 2.0.0:
 * - Adicionado timeout de segurança para a operação de escrita (`setCachedData`).
 * - Logs padronizados para maior consistência e facilidade de depuração.
 */

import { createHash } from 'crypto';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { logger } from '../logger';
import { redisClient, CACHE_ENABLED, CACHE_TIMEOUT_MS, CACHE_EXPIRATION_SECONDS } from './config';
import { SERVICE_TAG } from './types';

const CACHE_TAG = `${SERVICE_TAG}[Cache]`;

/**
 * Gera uma chave de cache SHA256 a partir da pergunta e do histórico.
 * @param query - A pergunta atual do usuário.
 * @param history - O histórico de mensagens da conversa.
 * @returns A chave de cache em formato hexadecimal.
 */
export function generateCacheKey(query: string, history: ChatCompletionMessageParam[]): string {
    const payload = JSON.stringify({ query, history });
    return `admin-ai-cache:${createHash('sha256').update(payload).digest('hex')}`;
}

/**
 * Busca um dado no cache Redis, com um timeout para evitar bloqueios.
 * @param key - A chave do cache.
 * @returns O dado em string se encontrado, ou null caso contrário.
 */
export async function getCachedData(key: string): Promise<string | null> {
    if (!CACHE_ENABLED || !redisClient?.isOpen) {
        if (CACHE_ENABLED) logger.warn(`${CACHE_TAG} Cache habilitado, mas o cliente Redis não está conectado. Impossível ler a chave: ${key}`);
        return null;
    }
    
    try {
        // Implementa um timeout para a operação de get
        return await Promise.race([
            redisClient.get(key),
            new Promise<null>((_, reject) => 
                setTimeout(() => reject(new Error('Redis GET operation timed out')), CACHE_TIMEOUT_MS)
            )
        ]);
    } catch (err) {
        logger.error(`${CACHE_TAG} Erro ao ler a chave '${key}' (pode ser timeout). Continuando sem cache.`, err);
        return null;
    }
}

/**
 * Armazena um dado no cache Redis, com um timeout de segurança.
 * @param key - A chave do cache.
 * @param value - O valor a ser armazenado.
 */
export async function setCachedData(key: string, value: string): Promise<void> {
    if (!CACHE_ENABLED || !redisClient?.isOpen) {
        if (CACHE_ENABLED) logger.warn(`${CACHE_TAG} Cache habilitado, mas o cliente Redis não está conectado. Impossível salvar a chave: ${key}`);
        return;
    }

    try {
        // Implementa um timeout para a operação de set
        await Promise.race([
            redisClient.set(key, value, { EX: CACHE_EXPIRATION_SECONDS }),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Redis SET operation timed out')), CACHE_TIMEOUT_MS)
            )
        ]);
        logger.info(`${CACHE_TAG} Resposta armazenada com sucesso para a chave: ${key}`);
    } catch (err) {
        logger.error(`${CACHE_TAG} Falha ao armazenar a chave '${key}' no cache (pode ser timeout).`, err);
    }
}
