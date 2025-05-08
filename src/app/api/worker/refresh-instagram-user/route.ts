// src/app/api/worker/refresh-instagram-user/route.ts (VERSÃO SIMPLIFICADA PARA TESTE)
import { NextRequest, NextResponse } from 'next/server';
// import { Receiver } from "@upstash/qstash"; // Comentado para teste
import { logger } from '@/app/lib/logger';
// import { triggerDataRefresh } from '@/app/lib/instagramService'; // Comentado para teste
// import mongoose from 'mongoose'; // Comentado para teste

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TAG = '[Worker RefreshInstagramUser - SIMPLIFIED TEST]';

/**
 * POST /api/worker/refresh-instagram-user (Versão Simplificada)
 * Apenas loga o recebimento e retorna sucesso.
 */
export async function POST(request: NextRequest) {
  // <<< LOG ÚNICO PARA VERIFICAR SE A FUNÇÃO É CHAMADA >>>
  logger.info(`${TAG} Handler POST FOI INVOCADO! Recebeu requisição.`);

  try {
    // Lê o corpo apenas para log, mas não faz nada com ele
    const bodyText = await request.text();
    logger.debug(`${TAG} Corpo recebido (texto): ${bodyText}`);

    // Comenta toda a lógica de verificação e processamento
    /*
    const signature = request.headers.get('upstash-signature');
    if (!signature) { ... }
    const isValid = await receiver.verify({ signature, body: bodyText });
    if (!isValid) { ... }
    let payload = JSON.parse(bodyText);
    let userId = payload?.userId;
    if (!userId || ...) { ... }
    const refreshResult = await triggerDataRefresh(userId);
    if (refreshResult.success) { ... } else { ... }
    */

    // Retorna sucesso imediatamente
    logger.info(`${TAG} Retornando sucesso (teste simplificado).`);
    return NextResponse.json({ success: true, message: "Simplified test OK" }, { status: 200 });

  } catch (error) {
    logger.error(`${TAG} Erro GERAL no worker simplificado:`, error);
    // Retorna 500 em caso de erro inesperado aqui
    return NextResponse.json({ error: 'Internal server error in simplified worker' }, { status: 500 });
  }
}
