// src/app/lib/instagramService.ts

import { connectToDatabase } from "@/app/lib/mongoose";
import DbUser, { IUser } from "@/app/models/User"; // Importa o modelo User atualizado
import { logger } from "@/app/lib/logger";
import mongoose from "mongoose";

const INSTAGRAM_API_VERSION = 'v19.0'; // Define a versão da API a ser usada

interface InstagramConnectionDetails {
    accessToken: string | null;
    accountId: string | null;
}

interface InstagramMedia {
    id: string;
    // Outros campos que você pode querer buscar depois (caption, media_type, etc.)
}

interface FetchMediaResult {
    success: boolean;
    data?: InstagramMedia[];
    error?: string;
    nextPageUrl?: string | null; // Para paginação futura
}

/**
 * Busca o token de acesso e o ID da conta do Instagram para um usuário no banco de dados.
 * @param userId - O ID do usuário na sua plataforma (MongoDB ObjectId).
 * @returns Um objeto contendo o accessToken e accountId, ou null se não encontrados/erro.
 */
async function getInstagramConnectionDetails(userId: string | mongoose.Types.ObjectId): Promise<InstagramConnectionDetails | null> {
    const TAG = '[getInstagramConnectionDetails]';
    logger.debug(`${TAG} Buscando detalhes de conexão IG para User ${userId}...`);

    if (!mongoose.isValidObjectId(userId)) {
        logger.error(`${TAG} ID de usuário inválido: ${userId}`);
        return null;
    }

    try {
        await connectToDatabase();
        const user = await DbUser.findById(userId)
            .select('instagramAccessToken instagramAccountId') // Seleciona apenas os campos necessários
            .lean(); // Usa lean para performance

        if (!user) {
            logger.warn(`${TAG} Usuário ${userId} não encontrado no DB.`);
            return null;
        }

        // Verifica se os campos necessários existem
        const accessToken = user.instagramAccessToken ?? null;
        const accountId = user.instagramAccountId ?? null;

        if (!accessToken || !accountId) {
            logger.warn(`${TAG} Token de acesso (${accessToken ? 'OK' : 'Ausente'}) ou ID da conta IG (${accountId ? 'OK' : 'Ausente'}) não encontrados para User ${userId}.`);
            // Retorna null ou os valores encontrados, dependendo se você quer tratar isso como erro aqui
            return { accessToken, accountId };
        }

        logger.debug(`${TAG} Detalhes de conexão IG encontrados para User ${userId}.`);
        return { accessToken, accountId };

    } catch (error) {
        logger.error(`${TAG} Erro ao buscar detalhes de conexão IG para User ${userId}:`, error);
        return null;
    }
}

/**
 * Busca as mídias recentes de uma conta do Instagram.
 * @param userId - O ID do usuário na sua plataforma.
 * @returns Um objeto com o resultado da busca (sucesso, dados, erro).
 */
export async function fetchInstagramMedia(userId: string): Promise<FetchMediaResult> {
    const TAG = '[fetchInstagramMedia]';
    logger.info(`${TAG} Iniciando busca de mídias para User ${userId}...`);

    // 1. Obter detalhes da conexão
    const connectionDetails = await getInstagramConnectionDetails(userId);

    if (!connectionDetails) {
        return { success: false, error: 'Detalhes de conexão com Instagram não encontrados ou inválidos.' };
    }
    if (!connectionDetails.accessToken || !connectionDetails.accountId) {
         return { success: false, error: 'Conexão com Instagram incompleta (Token ou ID da Conta ausente).' };
    }

    const { accessToken, accountId } = connectionDetails;

    // 2. Montar URL da API
    // Busca os campos básicos da mídia. Adicione mais campos conforme necessário (ex: caption, media_type, timestamp, permalink)
    const fields = 'id,media_type,timestamp,caption,permalink';
    const url = `https://graph.facebook.com/${INSTAGRAM_API_VERSION}/${accountId}/media?fields=${fields}&access_token=${accessToken}`;
    logger.debug(`${TAG} URL da API: ${url.replace(accessToken, '[TOKEN_OCULTO]')}`);

    // 3. Chamar a API
    try {
        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
            logger.error(`${TAG} Erro da API do Instagram ao buscar mídias para User ${userId}:`, data);
            const errorMessage = data.error?.message || `Erro ${response.status} da API`;
            // Tratar erros específicos (ex: token expirado, permissões insuficientes) aqui no futuro
            if (data.error?.code === 190) { // Exemplo: Erro de autenticação
                 // TODO: Marcar token como inválido no DB, notificar usuário?
                 return { success: false, error: 'Token de acesso inválido ou expirado. Reconecte sua conta.' };
            }
            return { success: false, error: `Falha ao buscar mídias: ${errorMessage}` };
        }

        logger.info(`${TAG} Mídias buscadas com sucesso para User ${userId}. ${data.data?.length || 0} itens retornados.`);

        // TODO: Implementar lógica de paginação usando data.paging?.next

        return {
            success: true,
            data: data.data || [], // Retorna os dados das mídias
            nextPageUrl: data.paging?.next || null, // Para paginação futura
        };

    } catch (error: unknown) {
        logger.error(`${TAG} Erro de rede ou inesperado ao buscar mídias para User ${userId}:`, error);
        const message = error instanceof Error ? error.message : String(error);
        return { success: false, error: `Erro interno ao buscar mídias: ${message}` };
    }
}

// --- Outras Funções Futuras ---
// async function fetchMediaInsights(mediaId: string, accessToken: string): Promise<any> { ... }
// async function fetchStoryInsights(mediaId: string, accessToken: string): Promise<any> { ... }
// async function fetchAccountInsights(accountId: string, accessToken: string): Promise<any> { ... }
// async function fetchMediaComments(mediaId: string, accessToken: string): Promise<any> { ... }
// async function triggerDataRefresh(userId: string): Promise<void> { /* Orquestra as chamadas acima */ }

