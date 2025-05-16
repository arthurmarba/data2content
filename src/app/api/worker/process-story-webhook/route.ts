// src/app/api/worker/process-story-webhook/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { Receiver } from "@upstash/qstash"; // Para verificar chamadas do QStash
import { logger } from '@/app/lib/logger';
// ATUALIZADO para o novo módulo
import { processStoryWebhookPayload } from '@/app/lib/instagram'; 
import type { StoryWebhookValue } from '@/app/lib/instagram/types'; // Importando o tipo para clareza

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// --- INICIALIZAÇÃO DO QSTASH RECEIVER ---
const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;

let receiver: Receiver | null = null;
let initError: string | null = null;

if (!currentSigningKey || !nextSigningKey) {
    initError = "Chaves de assinatura QStash (CURRENT ou NEXT) não definidas no ambiente.";
    logger.error(`[Worker ProcessStoryWebhook Init] ${initError}`);
} else {
    try {
        receiver = new Receiver({
            currentSigningKey: currentSigningKey,
            nextSigningKey: nextSigningKey,
        });
        logger.info(`[Worker ProcessStoryWebhook Init] QStash Receiver inicializado.`);
    } catch (e) {
         initError = `Erro ao inicializar QStash Receiver: ${e instanceof Error ? e.message : String(e)}`;
         logger.error(`[Worker ProcessStoryWebhook Init] ${initError}`);
    }
}
// --- FIM DA INICIALIZAÇÃO ---


/**
 * POST /api/worker/process-story-webhook
 * Endpoint "trabalhador" chamado pelo QStash para processar UM evento
 * de webhook 'story_insights' específico.
 */
export async function POST(request: NextRequest) {
  const TAG = '[Worker ProcessStoryWebhook]';

  // Verifica se houve erro na inicialização do Receiver
  if (!receiver) {
      logger.error(`${TAG} Erro na inicialização do QStash Receiver: ${initError}`);
      return NextResponse.json({ error: `Configuration error: ${initError}` }, { status: 500 });
  }

  let mediaId: string | null = null;
  let valuePayload: StoryWebhookValue | null = null; // Usar o tipo importado
  let webhookAccountId: string | undefined = undefined;

  try {
    // 1. Verificar Assinatura QStash (SEGURANÇA)
    const signature = request.headers.get('upstash-signature');
    if (!signature) {
        logger.error(`${TAG} Header 'upstash-signature' ausente.`);
        return NextResponse.json({ error: 'Missing signature header' }, { status: 401 });
    }

    const bodyText = await request.text();
    const isValid = await receiver.verify({ signature, body: bodyText });

    if (!isValid) {
      logger.error(`${TAG} Assinatura QStash inválida recebida.`);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
    logger.info(`${TAG} Assinatura QStash verificada com sucesso.`);

    // 2. Extrair media_id, value e accountId do corpo da requisição
    let parsedBody: any;
    try {
        parsedBody = JSON.parse(bodyText);
        // O endpoint anterior (/api/webhooks/instagram) deve enviar um payload como:
        // { media_id: "...", value: {...}, account_id: "..." }
        mediaId = parsedBody?.media_id;
        valuePayload = parsedBody?.value as StoryWebhookValue; // Cast para o tipo esperado
        webhookAccountId = parsedBody?.account_id;

    } catch (parseError) {
        logger.error(`${TAG} Erro ao parsear corpo da requisição JSON:`, parseError);
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // Valida se os dados essenciais foram recebidos
    if (!mediaId || typeof mediaId !== 'string') {
        logger.error(`${TAG} 'media_id' ausente ou inválido no corpo da requisição: ${mediaId}`);
        return NextResponse.json({ error: 'Missing or invalid media_id in request body' }, { status: 400 });
    }
     if (!valuePayload || typeof valuePayload !== 'object') { // valuePayload agora é StoryWebhookValue | null
        logger.error(`${TAG} Objeto 'value' ausente ou inválido no corpo da requisição para Media ID ${mediaId}.`);
        return NextResponse.json({ error: 'Missing or invalid value object in request body' }, { status: 400 });
    }
    if (webhookAccountId) {
        logger.info(`${TAG} Recebida tarefa para processar webhook do Story Media ID: ${mediaId} para Account ID: ${webhookAccountId}`);
    } else {
        // Considerar se webhookAccountId é opcional ou obrigatório. Se obrigatório, retornar erro 400.
        logger.warn(`${TAG} Recebida tarefa para processar webhook do Story Media ID: ${mediaId}, mas Account ID (webhookAccountId) não foi fornecido no payload do QStash.`);
        // Se for obrigatório:
        // return NextResponse.json({ error: 'Missing account_id in request body from QStash' }, { status: 400 });
    }


    // 3. Chamar a função principal de processamento do webhook
    // A função processStoryWebhookPayload espera webhookAccountId e valuePayload
    const processResult = await processStoryWebhookPayload(mediaId, webhookAccountId, valuePayload);

    // 4. Logar e retornar o resultado
    if (processResult.success) {
        logger.info(`${TAG} Processamento do webhook para Story ${mediaId} concluído com sucesso.`);
        return NextResponse.json({ success: true, message: `Webhook for story ${mediaId} processed.` }, { status: 200 });
    } else {
        logger.error(`${TAG} Falha ao processar webhook para Story ${mediaId}. Erro: ${processResult.error}`);
        // Retorna 200 OK mesmo em falha de lógica de negócio para que QStash não tente reenviar indefinidamente
        // a menos que seja um erro que justifique um reenvio (ex: erro de DB temporário, não um erro de dados inválidos).
        // Se o erro for recuperável, poderia retornar um status 5xx para QStash tentar novamente.
        return NextResponse.json({ success: false, message: `Failed to process webhook for story ${mediaId}: ${processResult.error}` }, { status: 200 });
    }

  } catch (error) {
    // Captura erros inesperados no worker
    logger.error(`${TAG} Erro GERAL não tratado no Worker para Story ${mediaId ?? 'ID desconhecido'}:`, error);
    return NextResponse.json({ error: 'Internal server error during webhook processing' }, { status: 500 });
  }
}
