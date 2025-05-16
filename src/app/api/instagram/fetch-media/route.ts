// src/app/api/instagram/fetch-media/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
// ATUALIZADO para o novo módulo
import {
    fetchInstagramMedia,
    getInstagramConnectionDetails 
} from '@/app/lib/instagram';
import type { InstagramConnectionDetails } from '@/app/lib/instagram/types'; // Importando o tipo para clareza
import { logger } from '@/app/lib/logger';
import mongoose from 'mongoose';


export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';


/**
 * GET /api/instagram/fetch-media
 * Busca as mídias recentes do Instagram para o usuário autenticado.
 * Suporta paginação através do parâmetro de URL 'pageUrl'.
 */
export async function GET(request: NextRequest) {
    const TAG = '[GET /api/instagram/fetch-media]';
    logger.info(`${TAG} Rota chamada.`);

    try {
        // 1. Autenticação e Obtenção do ID do Utilizador
        logger.debug(`${TAG} Verificando sessão...`);
        const session = await getServerSession(authOptions);

        if (!session?.user?.id || !mongoose.isValidObjectId(session.user.id)) {
            logger.warn(`${TAG} Tentativa de acesso não autenticada ou ID de usuário inválido. User ID: ${session?.user?.id}`);
            return NextResponse.json({ error: 'Não autenticado ou ID de usuário inválido' }, { status: 401 });
        }
        const userId = session.user.id;
        logger.info(`${TAG} Requisição autenticada para User ${userId}.`);

        // 2. Obter Detalhes da Conexão Instagram (accountId e accessToken)
        logger.debug(`${TAG} Chamando getInstagramConnectionDetails para User ${userId}...`);
        const connectionDetails: InstagramConnectionDetails | null = await getInstagramConnectionDetails(userId);

        // Lógica de verificação ajustada para o tipo retornado por getInstagramConnectionDetails
        if (!connectionDetails) {
            logger.warn(`${TAG} Detalhes de conexão do Instagram não encontrados para User ${userId} (usuário não encontrado no DB ou erro no serviço getInstagramConnectionDetails).`);
            return NextResponse.json({ error: 'Falha ao obter detalhes de conexão do Instagram. O usuário pode não estar conectado ou ocorreu um erro.' }, { status: 400 });
        }
        
        if (!connectionDetails.accountId) {
            logger.warn(`${TAG} ID da conta Instagram (accountId) não encontrado nos detalhes de conexão para User ${userId}.`);
            return NextResponse.json({ error: 'ID da conta Instagram não configurado para este usuário.' }, { status: 400 });
        }
        
        if (!connectionDetails.accessToken) {
            logger.warn(`${TAG} Token de acesso (accessToken) não encontrado nos detalhes de conexão para User ${userId}. A conta pode precisar ser reconectada.`);
            return NextResponse.json({ error: 'Token de acesso do Instagram não encontrado. Por favor, reconecte sua conta.' }, { status: 403 }); // 403 Forbidden, pois o token é necessário
        }
        
        const { accountId, accessToken } = connectionDetails; // accessToken aqui é garantido como string
        logger.info(`${TAG} Detalhes de conexão obtidos para User ${userId}. Instagram Account ID: ${accountId}`);

        // 3. Obter 'pageUrl' dos parâmetros da URL para paginação
        const pageUrlQueryParam = request.nextUrl.searchParams.get('pageUrl');
        const pageUrl = pageUrlQueryParam ? decodeURIComponent(pageUrlQueryParam) : undefined;

        if (pageUrl) {
            logger.debug(`${TAG} Parâmetro de paginação 'pageUrl' recebido: ${pageUrl}`);
        }

        // 4. Chamar o Serviço para Buscar Mídias
        logger.debug(`${TAG} Chamando fetchInstagramMedia para Instagram Account ${accountId} (User ${userId})${pageUrl ? ` com pageUrl` : ''}...`);
        const mediaResult = await fetchInstagramMedia(accountId, accessToken, pageUrl);

        // 5. Retornar a Resposta
        if (mediaResult.success) {
            logger.info(`${TAG} Busca de mídias bem-sucedida para Instagram Account ${accountId}. Itens: ${mediaResult.data?.length ?? 0}. Próxima página: ${!!mediaResult.nextPageUrl}`);
            return NextResponse.json({
                message: "Mídias buscadas com sucesso.",
                data: mediaResult.data,
                nextPageUrl: mediaResult.nextPageUrl
            }, { status: 200 });
        } else {
            logger.error(`${TAG} Falha ao buscar mídias para Instagram Account ${accountId}: ${mediaResult.error}`);
            // Tratar erros específicos de token/permissão com status 403
            if (mediaResult.error?.toLowerCase().includes('token') || mediaResult.error?.toLowerCase().includes('oauth') || mediaResult.error?.toLowerCase().includes('permiss')) {
                 return NextResponse.json({ error: mediaResult.error }, { status: 403 }); // Forbidden
            }
            // Outros erros podem ser 500 ou 400 dependendo da natureza
            return NextResponse.json({ error: mediaResult.error || "Falha ao buscar mídias do Instagram." }, { status: 500 });
        }

    } catch (error: unknown) {
        logger.error(`${TAG} Erro GERAL inesperado na rota:`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        // O Next.js pode lançar erros com um campo 'digest' para erros de servidor dinâmicos
        if (error instanceof Error && (error as any).digest === 'DYNAMIC_SERVER_USAGE') {
             logger.error(`${TAG} Erro DYNAMIC_SERVER_USAGE capturado. Verifique uso de headers/cookies ou outras funções dinâmicas.`);
        }
        return NextResponse.json({ error: "Erro interno do servidor", details: errorMessage }, { status: 500 });
    }
}
