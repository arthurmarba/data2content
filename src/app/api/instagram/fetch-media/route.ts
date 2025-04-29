// src/app/api/instagram/fetch-media/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route'; // Ajuste o caminho se necessário
import { fetchInstagramMedia } from '@/app/lib/instagramService'; // Importa a função do serviço
import { logger } from '@/app/lib/logger';

export const runtime = 'nodejs'; // Garante execução no Node.js

// --- ADICIONADO: Força a rota a ser dinâmica ---
export const dynamic = 'force-dynamic';
// ---------------------------------------------

/**
 * GET /api/instagram/fetch-media
 * Busca as mídias recentes do Instagram para o usuário autenticado.
 */
export async function GET(request: NextRequest) {
    const TAG = '[GET /api/instagram/fetch-media]';
    logger.info(`${TAG} Rota chamada.`);

    try {
        // 1. Autenticação e Obtenção do ID do Utilizador
        logger.debug(`${TAG} Verificando sessão...`);
        // Passa o request diretamente para getServerSession funcionar corretamente no Route Handler
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            logger.warn(`${TAG} Tentativa de acesso não autenticada.`);
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
        }
        const userId = session.user.id;
        logger.info(`${TAG} Requisição autenticada para User ${userId}.`);

        // 2. Chamar o Serviço para Buscar Mídias
        logger.debug(`${TAG} Chamando fetchInstagramMedia para User ${userId}...`);
        const result = await fetchInstagramMedia(userId);

        // 3. Retornar a Resposta
        if (result.success) {
            logger.info(`${TAG} Busca de mídias bem-sucedida para User ${userId}.`);
            return NextResponse.json({
                message: "Mídias buscadas com sucesso.",
                data: result.data,
                nextPageUrl: result.nextPageUrl // Inclui URL de paginação se houver
            }, { status: 200 });
        } else {
            logger.error(`${TAG} Falha ao buscar mídias para User ${userId}: ${result.error}`);
            // Retorna um erro mais específico se for problema de conexão/token
            if (result.error?.includes('Token de acesso inválido')) {
                 return NextResponse.json({ error: result.error }, { status: 403 }); // Forbidden - problema de token
            }
             if (result.error?.includes('Conexão com Instagram incompleta')) {
                 return NextResponse.json({ error: result.error }, { status: 400 }); // Bad Request - falta configuração
            }
            // Erro genérico do serviço
            return NextResponse.json({ error: result.error || "Falha ao buscar mídias do Instagram." }, { status: 500 });
        }

    } catch (error: unknown) {
        logger.error(`${TAG} Erro GERAL inesperado na rota:`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        // Verifica se o erro é o DynamicServerError para dar um retorno mais específico, se necessário
        if (error instanceof Error && (error as any).digest === 'DYNAMIC_SERVER_USAGE') {
             logger.error(`${TAG} Erro DYNAMIC_SERVER_USAGE capturado. Verifique uso de headers/cookies.`);
             // Poderia retornar um erro 500 específico, mas geralmente o catch geral já cobre
        }
        return NextResponse.json({ error: "Erro interno do servidor", details: errorMessage }, { status: 500 });
    }
}
