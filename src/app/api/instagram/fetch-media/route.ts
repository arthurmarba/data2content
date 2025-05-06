// src/app/api/instagram/fetch-media/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import {
    fetchInstagramMedia,
    getInstagramConnectionDetails // Assume que esta função retorna um tipo como InstagramConnectionDetailsFromService | null
} from '@/app/lib/instagramService';
import { logger } from '@/app/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Não vamos mais definir ConnectionDetailsResult aqui,
// vamos inferir o tipo ou usar o tipo real do seu instagramService se exportado.
// Para o propósito desta correção, vamos assumir que getInstagramConnectionDetails
// retorna algo como:
// interface InstagramConnectionDetailsFromService {
//   accountId?: string;
//   accessToken?: string;
//   error?: string; // Opcional, se o serviço retornar um erro estruturado
//   // ...outras propriedades que seu serviço possa retornar
// }
// e que a função retorna Promise<InstagramConnectionDetailsFromService | null>

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

        if (!session?.user?.id) {
            logger.warn(`${TAG} Tentativa de acesso não autenticada.`);
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
        }
        const userId = session.user.id;
        logger.info(`${TAG} Requisição autenticada para User ${userId}.`);

        // 2. Obter Detalhes da Conexão Instagram (accountId e accessToken)
        logger.debug(`${TAG} Chamando getInstagramConnectionDetails para User ${userId}...`);
        const connectionDetailsResult = await getInstagramConnectionDetails(userId);

        // CORREÇÃO: Lógica de verificação ajustada para o tipo real retornado
        if (!connectionDetailsResult || !connectionDetailsResult.accountId || !connectionDetailsResult.accessToken) {
            // Tenta obter uma mensagem de erro específica do resultado, se existir,
            // caso contrário, usa uma mensagem genérica.
            // A coerção para 'any' é usada aqui porque não temos a definição exata do tipo
            // de erro retornado por getInstagramConnectionDetails. O ideal seria ter esse tipo.
            const errorMessage = (connectionDetailsResult as any)?.error ||
                                 'Falha ao obter detalhes de conexão do Instagram. O usuário pode não estar conectado, os dados estão ausentes ou ocorreu um erro inesperado no serviço.';
            logger.warn(`${TAG} Falha ao obter detalhes de conexão para User ${userId}: ${errorMessage}`);
            return NextResponse.json({ error: errorMessage }, { status: 400 }); // Bad Request - conexão incompleta/configuração
        }
        
        // Neste ponto, connectionDetailsResult não é nulo e possui accountId e accessToken.
        // TypeScript deve inferir os tipos de accountId e accessToken corretamente aqui.
        const { accountId, accessToken } = connectionDetailsResult;
        logger.info(`${TAG} Detalhes de conexão obtidos para User ${userId}. Instagram Account ID: ${accountId}`);

        // 3. Obter 'pageUrl' dos parâmetros da URL para paginação
        const pageUrlQueryParam = request.nextUrl.searchParams.get('pageUrl');
        const pageUrl = pageUrlQueryParam ? decodeURIComponent(pageUrlQueryParam) : undefined;

        if (pageUrl) {
            logger.debug(`${TAG} Parâmetro de paginação 'pageUrl' recebido: ${pageUrl}`);
        }

        // 4. Chamar o Serviço para Buscar Mídias com a nova assinatura
        logger.debug(`${TAG} Chamando fetchInstagramMedia para Instagram Account ${accountId} (User ${userId})${pageUrl ? ` com pageUrl` : ''}...`);
        // Assumindo que fetchInstagramMedia espera accountId e accessToken como strings.
        const mediaResult = await fetchInstagramMedia(accountId, accessToken, pageUrl);

        // 5. Retornar a Resposta
        if (mediaResult.success) { // Assumindo que mediaResult TEM uma propriedade 'success'
            logger.info(`${TAG} Busca de mídias bem-sucedida para Instagram Account ${accountId}.`);
            return NextResponse.json({
                message: "Mídias buscadas com sucesso.",
                data: mediaResult.data,
                nextPageUrl: mediaResult.nextPageUrl
            }, { status: 200 });
        } else {
            logger.error(`${TAG} Falha ao buscar mídias para Instagram Account ${accountId}: ${mediaResult.error}`);
            if (mediaResult.error?.includes('Token de acesso inválido') || mediaResult.error?.includes('OAuthException')) {
                 return NextResponse.json({ error: mediaResult.error }, { status: 403 });
            }
             if (mediaResult.error?.includes('Conexão com Instagram incompleta')) {
                 return NextResponse.json({ error: mediaResult.error }, { status: 400 });
            }
            return NextResponse.json({ error: mediaResult.error || "Falha ao buscar mídias do Instagram." }, { status: 500 });
        }

    } catch (error: unknown) {
        logger.error(`${TAG} Erro GERAL inesperado na rota:`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (error instanceof Error && (error as any).digest === 'DYNAMIC_SERVER_USAGE') {
             logger.error(`${TAG} Erro DYNAMIC_SERVER_USAGE capturado. Verifique uso de headers/cookies.`);
        }
        return NextResponse.json({ error: "Erro interno do servidor", details: errorMessage }, { status: 500 });
    }
}
