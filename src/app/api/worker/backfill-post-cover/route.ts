import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/app/lib/logger';
// CORREÇÃO: Removida a pasta '/posts' do caminho da importação.
import { backfillPostCover } from '@/app/lib/dataService/marketAnalysis/postsService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/worker/backfill-post-cover
 * Worker que processa uma única tarefa de preenchimento de capa de post.
 */
export async function POST(request: NextRequest) {
    const TAG = '[Worker BackfillPostCover]';

    try {
        const payload = await request.json();
        const { postId } = payload;

        if (!postId) {
            logger.warn(`${TAG} Recebido payload sem postId.`);
            return NextResponse.json({ error: 'Missing postId in payload' }, { status: 400 });
        }

        logger.info(`${TAG} Iniciando processamento para postId: ${postId}`);

        const result = await backfillPostCover(postId);

        if (!result.success) {
            // Retorna um erro para que o QStash possa tentar novamente, se configurado.
            logger.error(`${TAG} Falha ao processar postId ${postId}: ${result.message}`);
            return NextResponse.json({ success: false, error: result.message }, { status: 500 });
        }
        
        logger.info(`${TAG} Sucesso ao processar postId ${postId}.`);
        return NextResponse.json({ success: true, message: result.message }, { status: 200 });

    } catch (error: any) {
        logger.error(`${TAG} Erro não tratado no worker:`, error);
        // Retorna um erro genérico para a fila.
        return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
    }
}