// src/app/api/worker/refresh-instagram-user/route.ts (com logs de depuração)
import { NextRequest, NextResponse } from 'next/server';
import { Receiver } from "@upstash/qstash"; // Importa o Receiver QStash
import { logger } from '@/app/lib/logger';
import { triggerDataRefresh } from '@/app/lib/instagramService'; // Importa a função principal
import mongoose from 'mongoose'; // Para validar ObjectId

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // Garante execução dinâmica

// --- INICIALIZAÇÃO DO QSTASH RECEIVER ---
const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;

let receiver: Receiver | null = null;
let initError: string | null = null;

if (!currentSigningKey || !nextSigningKey) {
    initError = "Chaves de assinatura QStash (CURRENT ou NEXT) não definidas no ambiente.";
    logger.error(`[Worker RefreshInstagramUser Init] ${initError}`);
} else {
    try {
        receiver = new Receiver({
            currentSigningKey: currentSigningKey,
            nextSigningKey: nextSigningKey,
        });
        logger.info(`[Worker RefreshInstagramUser Init] QStash Receiver inicializado com sucesso.`);
    } catch (e: any) {
        initError = `Erro ao inicializar QStash Receiver: ${e.message}`;
        logger.error(`[Worker RefreshInstagramUser Init] ${initError}`);
    }
}
// --- FIM DA INICIALIZAÇÃO ---


/**
 * POST /api/worker/refresh-instagram-user
 * Endpoint "trabalhador" chamado pelo QStash para atualizar os dados de UM usuário específico.
 */
export async function POST(request: NextRequest) {
  const TAG = '[Worker RefreshInstagramUser]';
  // <<< LOG ADICIONAL 1: Início da Função >>>
  logger.info(`${TAG} Handler POST iniciado.`);

  // Verifica se houve erro na inicialização do Receiver
  if (!receiver) {
      logger.error(`${TAG} Erro CRÍTICO: QStash Receiver não inicializado. ${initError}`);
      // Retorna 500 para QStash tentar reenviar após correção da configuração.
      return NextResponse.json({ error: `Configuration error: ${initError || 'Receiver not initialized.'}` }, { status: 500 });
  }

  let userId: string | null = null;
  let bodyText: string | null = null; // Para logar o corpo

  try {
    // <<< LOG ADICIONAL 2: Antes de verificar assinatura >>>
    logger.info(`${TAG} Tentando verificar assinatura QStash...`);
    const signature = request.headers.get('upstash-signature');
    if (!signature) {
        logger.error(`${TAG} Header 'upstash-signature' ausente na requisição.`);
        return NextResponse.json({ error: 'Missing signature header' }, { status: 401 });
    }
    logger.debug(`${TAG} Header 'upstash-signature' encontrado: ${signature.substring(0, 10)}...`); // Loga parte da assinatura

    // Lê o corpo da requisição que o QStash enviou
    bodyText = await request.text(); // Lê o corpo como texto
    // <<< LOG ADICIONAL 3: Corpo da requisição lido >>>
    logger.debug(`${TAG} Corpo da requisição lido (texto): ${bodyText}`);

    const isValid = await receiver.verify({ signature, body: bodyText });

    if (!isValid) {
      logger.error(`${TAG} Assinatura QStash inválida recebida. Verifique as chaves no Upstash e nas variáveis de ambiente.`);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
    // <<< LOG ADICIONAL 4: Assinatura verificada >>>
    logger.info(`${TAG} Assinatura QStash verificada com sucesso.`);

    // 2. Extrair userId do corpo da requisição
    let payload: any;
    try {
        // <<< LOG ADICIONAL 5: Antes de parsear JSON >>>
        logger.debug(`${TAG} Tentando parsear corpo JSON...`);
        payload = JSON.parse(bodyText); // Parseia o texto lido anteriormente
        userId = payload?.userId;
        // <<< LOG ADICIONAL 6: Após parsear JSON >>>
        logger.info(`${TAG} Corpo JSON parseado com sucesso. Payload:`, payload);
    } catch (parseError) {
        logger.error(`${TAG} Erro ao parsear corpo da requisição JSON:`, parseError);
        logger.error(`${TAG} Corpo recebido (texto): ${bodyText}`); // Loga o corpo que falhou no parse
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // Valida o userId extraído
    if (!userId || typeof userId !== 'string' || !mongoose.isValidObjectId(userId)) {
        logger.error(`${TAG} 'userId' ausente, inválido ou não é um ObjectId no corpo da requisição: ${userId}`);
        return NextResponse.json({ error: 'Missing or invalid userId in request body' }, { status: 400 });
    }
    // <<< LOG ADICIONAL 7: userId válido encontrado >>>
    logger.info(`${TAG} Tarefa recebida e validada para User ID: ${userId}`);

    // 3. Chamar a função principal de atualização de dados
    // <<< LOG ADICIONAL 8: Antes de chamar triggerDataRefresh >>>
    logger.info(`${TAG} Chamando triggerDataRefresh para User ID: ${userId}...`);
    const refreshResult = await triggerDataRefresh(userId);
    // <<< LOG ADICIONAL 9: Após chamar triggerDataRefresh >>>
    logger.info(`${TAG} triggerDataRefresh concluído para User ID: ${userId}. Sucesso: ${refreshResult.success}`);


    // 4. Logar e retornar o resultado
    if (refreshResult.success) {
        logger.info(`${TAG} Atualização de dados para User ${userId} concluída com sucesso. Mensagem: ${refreshResult.message}`);
        return NextResponse.json({ success: true, message: refreshResult.message, details: refreshResult.details }, { status: 200 });
    } else {
        // Log detalhado da falha
        logger.error(`${TAG} Falha na atualização de dados (triggerDataRefresh) para User ${userId}. Mensagem: ${refreshResult.message}`, refreshResult.details ? { details: refreshResult.details } : {});
        // Retorna 200 para QStash não tentar reenviar automaticamente por falha na lógica de negócio,
        // mas indica a falha no corpo da resposta.
        return NextResponse.json({ success: false, message: refreshResult.message, details: refreshResult.details }, { status: 200 });
    }

  } catch (error) {
    // <<< LOG ADICIONAL 10: Erro geral não tratado >>>
    logger.error(`${TAG} Erro GERAL não tratado no Worker para User ${userId ?? 'ID desconhecido'}:`, error);
    // Retorna 500 para erro inesperado, QStash pode tentar reenviar.
    return NextResponse.json({ error: 'Internal server error in worker' }, { status: 500 });
  }
}

