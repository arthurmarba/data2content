// src/app/api/webhooks/instagram/route.ts

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto'; // Para validação da assinatura
import { Client as QStashClient } from "@upstash/qstash"; // Para enfileirar tarefas
import { logger } from '@/app/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// --- Configuração (Carregar das Variáveis de Ambiente) ---
const INSTAGRAM_VERIFY_TOKEN = process.env.INSTAGRAM_VERIFY_TOKEN;
const INSTAGRAM_APP_SECRET = process.env.INSTAGRAM_APP_SECRET; // Essencial para validar POST
const QSTASH_TOKEN = process.env.QSTASH_TOKEN;
// <<< DEFINIR URL DO NOVO WORKER >>> (Exemplo)
const STORY_WEBHOOK_WORKER_URL = `${process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL}/api/worker/process-story-webhook`;

// --- Inicialização do Cliente QStash ---
let qstashClient: QStashClient | null = null;
let initError: string | null = null;

if (!INSTAGRAM_VERIFY_TOKEN) {
    initError = (initError ? initError + " e " : "") + "INSTAGRAM_VERIFY_TOKEN não definido.";
}
if (!INSTAGRAM_APP_SECRET) {
    initError = (initError ? initError + " e " : "") + "INSTAGRAM_APP_SECRET não definido.";
}
if (!QSTASH_TOKEN) {
    initError = (initError ? initError + " e " : "") + "QSTASH_TOKEN não definido.";
}
if (!STORY_WEBHOOK_WORKER_URL || !STORY_WEBHOOK_WORKER_URL.startsWith('http')) {
    initError = (initError ? initError + " e " : "") + "URL do worker de webhook de story inválida.";
}

if (!initError) {
    try {
        qstashClient = new QStashClient({ token: QSTASH_TOKEN! }); // '!' pois já verificamos
        logger.info("[Webhook Instagram Init] Cliente QStash inicializado.");
    } catch (e) {
        initError = `Erro ao inicializar cliente QStash: ${e instanceof Error ? e.message : String(e)}`;
    }
}

if (initError) {
    logger.error(`[Webhook Instagram Init] Erro de configuração: ${initError}`);
}
// --- Fim Inicialização ---


/**
 * GET /api/webhooks/instagram
 * Usado pelo Meta para verificar a assinatura do endpoint do webhook.
 */
export async function GET(request: NextRequest) {
    const TAG = '[Webhook Instagram GET]';
    logger.info(`${TAG} Recebida requisição GET para verificação.`);

    if (initError) {
        logger.error(`${TAG} Erro de configuração impedindo verificação: ${initError}`);
        return NextResponse.json({ error: `Configuration error: ${initError}` }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    logger.debug(`${TAG} Parâmetros recebidos: mode=${mode}, token=${token ? 'presente' : 'ausente'}, challenge=${challenge ? 'presente' : 'ausente'}`);

    // Verifica se os parâmetros esperados estão presentes e se o token corresponde
    if (mode === 'subscribe' && token === INSTAGRAM_VERIFY_TOKEN) {
        logger.info(`${TAG} Verificação bem-sucedida. Respondendo com challenge.`);
        // Responde com o challenge para confirmar a assinatura
        return new NextResponse(challenge, { status: 200 });
    } else {
        logger.warn(`${TAG} Falha na verificação. Mode ou Token inválido. Mode: ${mode}, Token Recebido: ${token}, Token Esperado: ${INSTAGRAM_VERIFY_TOKEN}`);
        // Responde com 403 Forbidden se a verificação falhar
        return NextResponse.json({ error: 'Verification token mismatch or invalid mode' }, { status: 403 });
    }
}

/**
 * POST /api/webhooks/instagram
 * Recebe as notificações de eventos (ex: story_insights) do Instagram.
 */
export async function POST(request: NextRequest) {
    const TAG = '[Webhook Instagram POST]';
    logger.info(`${TAG} Recebida requisição POST (notificação de evento).`);

    if (initError || !qstashClient) {
        logger.error(`${TAG} Erro de configuração ou QStash não inicializado: ${initError}`);
        // Retorna 500 para indicar problema interno ao Meta
        return NextResponse.json({ error: `Configuration error: ${initError}` }, { status: 500 });
    }

    // 1. Validar Assinatura X-Hub-Signature-256 (SEGURANÇA CRÍTICA)
    const signatureHeader = request.headers.get('x-hub-signature-256');
    if (!signatureHeader) {
        logger.error(`${TAG} Header 'x-hub-signature-256' ausente. Requisição rejeitada.`);
        return NextResponse.json({ error: 'Missing signature header' }, { status: 401 });
    }

    const requestBody = await request.text(); // Lê o corpo como texto para validação

    try {
        const expectedSignature = crypto
            .createHmac('sha256', INSTAGRAM_APP_SECRET!) // '!' pois já verificamos
            .update(requestBody)
            .digest('hex');

        const signature = signatureHeader.split('=')[1]; // Formato é 'sha256=...'

        if (!signature || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
            logger.error(`${TAG} Assinatura inválida. Assinatura Recebida: ${signatureHeader}, Assinatura Esperada (hash): ${expectedSignature}. Requisição rejeitada.`);
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }
        logger.info(`${TAG} Assinatura validada com sucesso.`);

    } catch (err) {
         logger.error(`${TAG} Erro durante a validação da assinatura:`, err);
         return NextResponse.json({ error: 'Signature validation error' }, { status: 500 });
    }

    // 2. Parsear o Corpo da Requisição (Agora que a assinatura é válida)
    let payload: any;
    try {
        payload = JSON.parse(requestBody);
        logger.debug(`${TAG} Payload JSON parseado:`, JSON.stringify(payload).substring(0, 500) + '...'); // Log truncado
    } catch (err) {
        logger.error(`${TAG} Erro ao parsear corpo JSON:`, err);
        return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 }); // Bad Request
    }

    // 3. Processar o Payload (Enfileirar Tarefas)
    if (payload.object === 'instagram') {
        let tasksPublished = 0;
        let publishErrors = 0;

        // Itera sobre as entradas (pode haver múltiplas em um batch)
        for (const entry of payload.entry || []) {
            // <<< Extrai o ID da conta (geralmente o ID do usuário do Instagram) da entrada >>>
            const accountIdFromEntry = entry.id;
            if (!accountIdFromEntry) {
                logger.warn(`${TAG} 'entry.id' (accountId) não encontrado na entrada do webhook. Não será possível passar para o worker. Entry:`, entry);
            }

            // Itera sobre as mudanças dentro de cada entrada
            for (const change of entry.changes || []) {
                // Verifica se é o evento que nos interessa ('story_insights')
                if (change.field === 'story_insights') {
                    const mediaId = change.value?.media_id;
                    logger.info(`${TAG} Encontrado evento 'story_insights'. Media ID: ${mediaId}. Account ID (entry): ${accountIdFromEntry}. Enfileirando tarefa...`);

                    // Valida se temos o media_id
                    if (!mediaId) {
                        logger.error(`${TAG} Evento 'story_insights' recebido sem 'media_id' no 'value'. Ignorando mudança:`, change);
                        continue; // Pula para a próxima mudança
                    }

                    // Extrai dados relevantes para o worker
                    const workerPayload = {
                        media_id: mediaId,
                        value: change.value, // Envia o objeto 'value' inteiro
                        // <<< Inclui o accountId extraído da entry >>>
                        account_id: accountIdFromEntry
                    };

                    // Enfileira a tarefa no QStash para processamento assíncrono
                    try {
                        await qstashClient.publishJSON({
                            url: STORY_WEBHOOK_WORKER_URL,
                            body: workerPayload,
                        });
                        tasksPublished++;
                        logger.debug(`${TAG} Tarefa para processar webhook do Story ${workerPayload.media_id} (Account: ${accountIdFromEntry}) publicada com sucesso.`);
                    } catch (qstashError) {
                        publishErrors++;
                        logger.error(`${TAG} Falha ao publicar tarefa no QStash para Story ${workerPayload.media_id} (Account: ${accountIdFromEntry}):`, qstashError);
                    }
                } else {
                    logger.debug(`${TAG} Ignorando evento não esperado. Field: ${change.field}`);
                }
            } // Fim loop changes
        } // Fim loop entry

        logger.info(`${TAG} Processamento do payload concluído. Tarefas publicadas: ${tasksPublished}, Falhas: ${publishErrors}.`);

    } else {
        logger.warn(`${TAG} Recebido payload com object diferente de 'instagram': ${payload.object}`);
    }

    // 4. Responder 200 OK para o Meta IMEDIATAMENTE
    logger.info(`${TAG} Respondendo 200 OK para Meta.`);
    return NextResponse.json({ success: true }, { status: 200 });
}
