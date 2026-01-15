import fetch, { Response as FetchResponse } from 'node-fetch';
import retry from 'async-retry';
import { logger } from '@/app/lib/logger';
import { BASE_URL, RETRY_OPTIONS } from '../config/instagramApiConfig';
import { FacebookApiError, FacebookApiErrorStructure } from '../types';
import { isTokenInvalidError } from '../utils/tokenUtils';

export interface RefreshTokenResult {
    success: boolean;
    accessToken?: string;
    expiresIn?: number;
    expiresAt?: Date;
    error?: string;
}

/**
 * Atualiza um Token de Acesso de Longa Duração do usuário trocando-o por um novo.
 * Tokens de longa duração expiram em 60 dias. É recomendado atualizar quando estiverem perto de vencer.
 *
 * @param currentAccessToken O token de longa duração atual que está válido (ou expirando).
 * @returns Um objeto com o novo token, tempo de expiração e data de expiração calculada.
 */
export async function refreshLongLivedUserAccessToken(
    currentAccessToken: string
): Promise<RefreshTokenResult> {
    const TAG = '[refreshLongLivedUserAccessToken]';

    if (!process.env.FACEBOOK_CLIENT_ID || !process.env.FACEBOOK_CLIENT_SECRET) {
        logger.error(`${TAG} CLIENT_ID ou CLIENT_SECRET não definidos.`);
        return { success: false, error: 'Configuração de API ausente.' };
    }

    // Endpoint: GET /oauth/access_token?grant_type=fb_exchange_token&client_id={app-id}&client_secret={app-secret}&fb_exchange_token={your-access-token}
    const url = `${BASE_URL}/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.FACEBOOK_CLIENT_ID}&client_secret=${process.env.FACEBOOK_CLIENT_SECRET}&fb_exchange_token=${currentAccessToken}`;

    try {
        const result = await retry(async (bail, attemptNum) => {
            if (attemptNum > 1) logger.warn(`${TAG} Tentativa ${attemptNum} para refresh de token.`);

            const response: FetchResponse = await fetch(url);
            const contentType = response.headers.get('content-type');

            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                logger.error(`${TAG} Resposta não-JSON (Status ${response.status}): ${text.substring(0, 200)}`);
                bail(new Error(`API retornou não-JSON (Status ${response.status})`));
                return null;
            }

            const data: { access_token?: string; token_type?: string; expires_in?: number } & FacebookApiError = await response.json();

            if (!response.ok || data.error || !data.access_token) {
                const errorDetail: FacebookApiErrorStructure = data.error || {
                    message: `Erro HTTP ${response.status}`,
                    code: response.status,
                    type: 'HttpError',
                    fbtrace_id: 'N/A'
                };
                logger.error(`${TAG} Erro API no refresh (Status ${response.status}):`, JSON.stringify(errorDetail));

                if (isTokenInvalidError(errorDetail.code, errorDetail.error_subcode, errorDetail.message)) {
                    // Token atual já inválido/expirado demais para ser trocado?
                    bail(new Error('Token atual inválido para troca.'));
                    return null;
                }

                if (response.status >= 400 && response.status < 500 && response.status !== 429) {
                    bail(new Error(errorDetail.message));
                    return null;
                }
                throw new Error(errorDetail.message);
            }

            return data;
        }, RETRY_OPTIONS);

        if (result && result.access_token) {
            const expiresInSeconds = result.expires_in || (60 * 24 * 60 * 60); // Default 60 dias se não vier
            const expiresAt = new Date(Date.now() + (expiresInSeconds * 1000));

            logger.info(`${TAG} Token atualizado com sucesso. Expira em ${expiresInSeconds}s (${expiresAt.toISOString()}).`);

            return {
                success: true,
                accessToken: result.access_token,
                expiresIn: result.expires_in,
                expiresAt: expiresAt
            };
        }

        return { success: false, error: 'Falha desconhecida ao atualizar token.' };

    } catch (error: any) {
        logger.error(`${TAG} Exceção ao atualizar token:`, error);
        return { success: false, error: error.message || 'Erro interno.' };
    }
}
