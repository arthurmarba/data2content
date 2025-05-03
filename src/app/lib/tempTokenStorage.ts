// src/app/lib/tempTokenStorage.ts
// Serviço para armazenar e recuperar temporariamente o Long-Lived Access Token (LLAT)
// usando Upstash Redis.

import { Redis } from '@upstash/redis';
import { logger } from './logger'; // Importa seu logger existente

const TAG = '[TempTokenStorage]';
const LLAT_EXPIRATION_SECONDS = 60 * 10; // Expiração de 10 minutos para o token temporário

// Configuração do cliente Redis usando variáveis de ambiente
const redisClient = Redis.fromEnv();

/**
 * Armazena o Long-Lived Access Token (LLAT) temporariamente no Redis.
 *
 * @param userId O ID do usuário ao qual o token pertence.
 * @param llat O Long-Lived Access Token a ser armazenado.
 * @returns true se o token foi armazenado com sucesso, false caso contrário.
 */
export async function storeTemporaryLlat(userId: string, llat: string): Promise<boolean> {
    const key = `llat:${userId}`; // Chave única para o usuário
    logger.debug(`${TAG} Armazenando LLAT temporário para User ${userId} com chave ${key} (expira em ${LLAT_EXPIRATION_SECONDS}s)`);

    if (!userId || !llat) {
        logger.error(`${TAG} User ID ou LLAT ausente.`);
        return false;
    }

    try {
        // 'set' com 'ex' define o valor e a expiração em segundos atomicamente.
        const result = await redisClient.set(key, llat, { ex: LLAT_EXPIRATION_SECONDS });

        if (result === 'OK') {
            logger.info(`${TAG} LLAT temporário armazenado com sucesso para User ${userId}.`);
            return true;
        } else {
            logger.error(`${TAG} Falha ao armazenar LLAT temporário para User ${userId}. Resultado do Redis: ${result}`);
            return false;
        }
    } catch (error) {
        logger.error(`${TAG} Erro ao armazenar LLAT temporário no Redis para User ${userId}:`, error);
        return false;
    }
}

/**
 * Recupera e exclui o Long-Lived Access Token (LLAT) temporário do Redis.
 * O token só pode ser recuperado uma vez.
 *
 * @param userId O ID do usuário cujo token deve ser recuperado.
 * @returns O Long-Lived Access Token como string se encontrado, ou null caso contrário.
 */
export async function getTemporaryLlat(userId: string): Promise<string | null> {
    const key = `llat:${userId}`;
    logger.debug(`${TAG} Recuperando LLAT temporário para User ${userId} com chave ${key}`);

    if (!userId) {
        logger.error(`${TAG} User ID ausente ao tentar recuperar LLAT.`);
        return null;
    }

    try {
        // Recupera o valor
        const llat = await redisClient.get<string>(key);

        if (llat) {
            logger.info(`${TAG} LLAT temporário encontrado para User ${userId}. Excluindo a chave...`);
            // Exclui a chave após a recuperação para garantir uso único
            await redisClient.del(key);
            logger.debug(`${TAG} Chave ${key} excluída do Redis.`);
            return llat;
        } else {
            logger.warn(`${TAG} LLAT temporário não encontrado ou expirado para User ${userId} (chave: ${key}).`);
            return null;
        }
    } catch (error) {
        logger.error(`${TAG} Erro ao recuperar LLAT temporário do Redis para User ${userId}:`, error);
        return null;
    }
}

// Opcional: Função para limpar explicitamente (pode ser útil em alguns cenários)
export async function clearTemporaryLlat(userId: string): Promise<void> {
    const key = `llat:${userId}`;
    logger.debug(`${TAG} Limpando LLAT temporário explicitamente para User ${userId} com chave ${key}`);
     try {
        await redisClient.del(key);
     } catch (error) {
        logger.error(`${TAG} Erro ao limpar LLAT temporário explicitamente no Redis para User ${userId}:`, error);
     }
}
