// src/app/lib/instagram/api/client.ts
import fetch, { Response as FetchResponse, RequestInit as FetchRequestInit } from 'node-fetch';
import retry from 'async-retry';
import { logger } from '@/app/lib/logger';
import { isTokenInvalidError } from '../utils/tokenUtils';
import { RETRY_OPTIONS } from '../config/instagramApiConfig';
import { FacebookApiError, FacebookApiErrorStructure, InstagramApiResponse } from '../types';

// Opções de fetch que podem ser passadas para node-fetch
interface RequestOptions extends FetchRequestInit {
  // Adicione quaisquer opções personalizadas que você possa precisar no futuro
}

/**
 * Realiza uma requisição genérica para a API Graph do Facebook/Instagram,
 * esperando uma resposta no formato { data: T[] } (para listas).
 * Inclui lógica de retentativa e tratamento básico de erros.
 *
 * @template T - O tipo de dados esperado dentro do array 'data' da resposta da API.
 * @param {string} url - A URL completa para a requisição da API (incluindo access_token).
 * @param {RequestOptions} [options] - Opções para a requisição fetch (método, corpo, cabeçalhos, etc.).
 * @param {string} [logContext] - Um contexto para logging (ex: nome da função chamadora).
 * @param {string} [accessTokenToHide] - O token de acesso para ser ocultado dos logs.
 * @returns {Promise<InstagramApiResponse<T> & FacebookApiError>} Uma promessa que resolve para os dados da API ou rejeita com um erro.
 */
export async function graphApiRequest<T>(
  url: string,
  options?: RequestOptions,
  logContext: string = 'graphApiListRequest', // Renomeado para clareza
  accessTokenToHide?: string
): Promise<InstagramApiResponse<T> & FacebookApiError> { // Espera { data: T[] }
  const TAG = `[${logContext}]`;

  return retry(async (bail, attemptNum) => {
    const urlForLog = accessTokenToHide ? url.replace(accessTokenToHide, '[TOKEN_OCULTO]') : url;
    if (attemptNum > 1) {
      logger.warn(`${TAG} Tentativa ${attemptNum} para URL: ${urlForLog}`);
    } else {
      logger.debug(`${TAG} Chamando API (esperando lista). URL: ${urlForLog}`);
    }

    let response: FetchResponse;
    try {
      response = await fetch(url, options);
    } catch (networkError: any) {
      logger.error(`${TAG} Erro de rede na tentativa ${attemptNum} para ${urlForLog}:`, networkError);
      if (attemptNum === RETRY_OPTIONS.retries + 1) {
        bail(new Error(`Erro de rede persistente: ${networkError.message}`));
        throw new Error(`Erro de rede persistente: ${networkError.message}`);
      }
      throw networkError;
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const responseText = await response.text().catch(() => 'Falha ao ler corpo da resposta não-JSON.');
      logger.error(`${TAG} Resposta não-JSON recebida (Status: ${response.status}, Tentativa: ${attemptNum}). Conteúdo: ${responseText.substring(0, 500)}`);
      if (response.status >= 500) {
        throw new Error(`Servidor retornou resposta não-JSON (Status: ${response.status})`);
      }
      bail(new Error(`API retornou resposta não-JSON (Status: ${response.status})`));
      throw new Error(`API retornou resposta não-JSON (Status: ${response.status})`);
    }

    // Para graphApiRequest, esperamos o formato { data: T[] }
    const data: InstagramApiResponse<T> & FacebookApiError = await response.json();

    if (!response.ok || data.error) {
      const errorDetail: FacebookApiErrorStructure = data.error || {
        message: `Erro HTTP ${response.status} da API.`,
        code: response.status,
        type: 'HttpError',
        fbtrace_id: response.headers.get('x-fbtrace-id') || 'N/A',
      };
      logger.error(`${TAG} Erro da API (Tentativa ${attemptNum}, Status: ${response.status}) para ${urlForLog}:`, JSON.stringify(errorDetail));

      if (isTokenInvalidError(errorDetail.code, errorDetail.error_subcode, errorDetail.message)) {
        logger.warn(`${TAG} Erro de token/permissão detectado (${errorDetail.code}/${errorDetail.error_subcode || 'N/A'}). Não tentar novamente.`);
        bail(new Error(`Token/Permissão inválido: ${errorDetail.message} (Code: ${errorDetail.code}, Subcode: ${errorDetail.error_subcode})`));
        throw new Error(`Token/Permissão inválido: ${errorDetail.message}`);
      }

      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        logger.warn(`${TAG} Erro do cliente (${response.status}) não recuperável. Não tentar novamente.`);
        bail(new Error(`Falha na requisição (Erro ${response.status}): ${errorDetail.message}`));
        throw new Error(`Falha na requisição (Erro ${response.status}): ${errorDetail.message}`);
      }
      throw new Error(`Erro da API (Status ${response.status}): ${errorDetail.message}`);
    }
    // Validação adicional: verificar se 'data' é um array, como esperado para listagens
    if (!Array.isArray(data.data)) {
        logger.warn(`${TAG} Resposta da API não continha um array 'data' como esperado para uma lista. URL: ${urlForLog}. Resposta:`, data);
        bail(new Error(`Resposta da API inesperada: campo 'data' não é um array. (URL: ${urlForLog})`));
        throw new Error(`Resposta da API inesperada: campo 'data' não é um array.`);
    }

    return data;
  }, RETRY_OPTIONS);
}

/**
 * Realiza uma requisição para a API Graph do Facebook/Instagram para buscar um ÚNICO NÓ/OBJETO.
 * Espera uma resposta no formato T (o objeto diretamente), não { data: T[] }.
 * Inclui lógica de retentativa e tratamento básico de erros.
 *
 * @template T - O tipo do objeto esperado como resposta direta da API.
 * @param {string} url - A URL completa para a requisição da API (incluindo access_token).
 * @param {RequestOptions} [options] - Opções para a requisição fetch (método, corpo, cabeçalhos, etc.).
 * @param {string} [logContext] - Um contexto para logging.
 * @param {string} [accessTokenToHide] - O token de acesso para ser ocultado dos logs.
 * @returns {Promise<T & FacebookApiError>} Uma promessa que resolve para o objeto da API ou rejeita com um erro.
 */
export async function graphApiNodeRequest<T>(
  url: string,
  options?: RequestOptions,
  logContext: string = 'graphApiNodeRequest',
  accessTokenToHide?: string
): Promise<T & FacebookApiError> { // Espera T diretamente (com possível campo 'error')
  const TAG = `[${logContext}]`;

  return retry(async (bail, attemptNum) => {
    const urlForLog = accessTokenToHide ? url.replace(accessTokenToHide, '[TOKEN_OCULTO]') : url;
    if (attemptNum > 1) {
      logger.warn(`${TAG} Tentativa ${attemptNum} para URL: ${urlForLog}`);
    } else {
      logger.debug(`${TAG} Chamando API (esperando nó único). URL: ${urlForLog}`);
    }

    let response: FetchResponse;
    try {
      response = await fetch(url, options);
    } catch (networkError: any) {
      logger.error(`${TAG} Erro de rede na tentativa ${attemptNum} para ${urlForLog}:`, networkError);
      if (attemptNum === RETRY_OPTIONS.retries + 1) {
        bail(new Error(`Erro de rede persistente: ${networkError.message}`));
        throw new Error(`Erro de rede persistente: ${networkError.message}`);
      }
      throw networkError;
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const responseText = await response.text().catch(() => 'Falha ao ler corpo da resposta não-JSON.');
      logger.error(`${TAG} Resposta não-JSON recebida (Status: ${response.status}, Tentativa: ${attemptNum}). Conteúdo: ${responseText.substring(0, 500)}`);
      if (response.status >= 500) {
        throw new Error(`Servidor retornou resposta não-JSON (Status: ${response.status})`);
      }
      bail(new Error(`API retornou resposta não-JSON (Status: ${response.status})`));
      throw new Error(`API retornou resposta não-JSON (Status: ${response.status})`);
    }

    // Para graphApiNodeRequest, esperamos o objeto T diretamente (pode ter um campo 'error' no mesmo nível)
    const dataNode: T & FacebookApiError = await response.json();

    if (!response.ok || dataNode.error) {
      const errorDetail: FacebookApiErrorStructure = dataNode.error || {
        message: `Erro HTTP ${response.status} da API.`,
        code: response.status,
        type: 'HttpError',
        fbtrace_id: response.headers.get('x-fbtrace-id') || 'N/A',
      };
      logger.error(`${TAG} Erro da API (Tentativa ${attemptNum}, Status: ${response.status}) para ${urlForLog}:`, JSON.stringify(errorDetail));

      if (isTokenInvalidError(errorDetail.code, errorDetail.error_subcode, errorDetail.message)) {
        logger.warn(`${TAG} Erro de token/permissão detectado (${errorDetail.code}/${errorDetail.error_subcode || 'N/A'}). Não tentar novamente.`);
        bail(new Error(`Token/Permissão inválido: ${errorDetail.message} (Code: ${errorDetail.code}, Subcode: ${errorDetail.error_subcode})`));
        throw new Error(`Token/Permissão inválido: ${errorDetail.message}`);
      }

      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        logger.warn(`${TAG} Erro do cliente (${response.status}) não recuperável. Não tentar novamente.`);
        bail(new Error(`Falha na requisição (Erro ${response.status}): ${errorDetail.message}`));
        throw new Error(`Falha na requisição (Erro ${response.status}): ${errorDetail.message}`);
      }
      throw new Error(`Erro da API (Status ${response.status}): ${errorDetail.message}`);
    }
    // Validação adicional: verificar se 'dataNode' é um objeto e NÃO um array.
    // A API para um nó único deve retornar um objeto.
    if (typeof dataNode !== 'object' || dataNode === null || Array.isArray(dataNode)) { // CORREÇÃO AQUI: Array.isArray(dataNode)
        logger.warn(`${TAG} Resposta da API não era um objeto esperado para um nó único. URL: ${urlForLog}. Resposta:`, dataNode);
        bail(new Error(`Resposta da API inesperada: não é um objeto de nó único. (URL: ${urlForLog})`));
        throw new Error(`Resposta da API inesperada: não é um objeto de nó único.`);
    }

    return dataNode;
  }, RETRY_OPTIONS);
}
