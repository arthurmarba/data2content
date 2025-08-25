// /src/app/api/worker/backfill-post-cover/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/app/lib/logger';
import { connectMongo } from '@/server/db/connect';
import { backfillPostCover } from '@/app/lib/dataService/marketAnalysis/postsService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/worker/backfill-post-cover
 * Worker que processa uma única tarefa de preenchimento de capa de post.
 * Regra: falhas "esperadas" (sem token/sem mediaId/sem user/post inválido/inexistente e sem thumbnail na Graph)
 * viram SKIP (200), para evitar retentativas inúteis na fila.
 */
export async function POST(request: NextRequest) {
  const TAG = '[Worker BackfillPostCover]';

  try {
    // Parse seguro do JSON
    let payload: any = null;
    try {
      payload = await request.json();
    } catch {
      logger.warn(`${TAG} Payload inválido (JSON parse error).`);
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const { postId } = payload ?? {};
    if (!postId) {
      logger.warn(`${TAG} Recebido payload sem postId.`);
      return NextResponse.json({ error: 'Missing postId in payload' }, { status: 400 });
    }

    // Garante conexão antes do serviço (idempotente; helper unificado)
    await connectMongo();

    logger.info(`${TAG} Iniciando processamento para postId: ${postId}`);

    const result = await backfillPostCover(postId);

    // Padrões "soft-skip" — não vale a pena re-tentar
    // Inclui casos de ausência de dados (token/user/mediaId/post) e a falta de thumbnail na Graph.
    const SOFT_SKIP_PATTERNS = [
      'access token not found',
      'does not have an instagrammediaid',
      'does not have an associated user',
      'post not found',
      'invalid post id format',
      'failed to fetch thumbnail',      // mensagem atual
      'graph returned no thumbnail',    // caso futuro/alternativo
      'no_cover_from_ig',               // blockedReason salvo no banco
    ];

    const msg = (result?.message || '').toLowerCase();
    const isSoftSkip =
      !result.success &&
      SOFT_SKIP_PATTERNS.some((p) => msg.includes(p));

    if (isSoftSkip) {
      logger.warn(`${TAG} SKIPPED (soft-fail) para postId ${postId}: ${result.message}`);
      return NextResponse.json(
        { success: true, skipped: true, reason: 'precondition_not_met', message: result.message },
        { status: 200 }
      );
    }

    if (!result.success) {
      // Erros reais → 500 para permitir retry conforme política da fila
      logger.error(`${TAG} Falha ao processar postId ${postId}: ${result.message}`);
      return NextResponse.json({ success: false, error: result.message }, { status: 500 });
    }

    logger.info(`${TAG} Sucesso ao processar postId ${postId}.`);
    return NextResponse.json({ success: true, message: result.message }, { status: 200 });
  } catch (error: any) {
    logger.error(`${TAG} Erro não tratado no worker:`, error);
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message ?? String(error) },
      { status: 500 }
    );
  }
}
