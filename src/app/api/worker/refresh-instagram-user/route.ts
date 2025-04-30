import { NextRequest, NextResponse } from 'next/server';
import { Receiver } from "@upstash/qstash"; // Importa o Receiver QStash
import { logger } from '@/app/lib/logger';
import { triggerDataRefresh } from '@/app/lib/instagramService'; // Importa a função principal
import mongoose from 'mongoose'; // Para validar ObjectId

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // Garante execução dinâmica

// --- INICIALIZAÇÃO DO QSTASH RECEIVER ---
// Pega as chaves do ambiente (essencial para verificar a assinatura)
const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;

let receiver: Receiver | null = null;
let initError: string | null = null;

if (!currentSigningKey || !nextSigningKey) {
    initError = "Chaves de assinatura QStash (CURRENT ou NEXT) não definidas no ambiente.";
    logger.error(`[Worker RefreshInstagramUser Init] ${initError}`);
} else {
    receiver = new Receiver({
        currentSigningKey: currentSigningKey,
        nextSigningKey: nextSigningKey,
    });
    logger.info(`[Worker RefreshInstagramUser Init] QStash Receiver inicializado.`);
}
// --- FIM DA INICIALIZAÇÃO ---


/**
 * POST /api/worker/refresh-instagram-user
 * Endpoint "trabalhador" chamado pelo QStash para atualizar os dados de UM usuário específico.
 */
export async function POST(request: NextRequest) {
  const TAG = '[Worker RefreshInstagramUser]';

  // Verifica se houve erro na inicialização do Receiver
  if (!receiver) {
      logger.error(`${TAG} Erro na inicialização do QStash Receiver: ${initError}`);
      return NextResponse.json({ error: `Configuration error: ${initError}` }, { status: 500 });
  }

  let userId: string | null = null; // Para guardar o userId extraído

  try {
    // 1. Verificar Assinatura QStash (SEGURANÇA)
    const signature = request.headers.get('upstash-signature');
    if (!signature) {
        logger.error(`${TAG} Header 'upstash-signature' ausente.`);
        return NextResponse.json({ error: 'Missing signature header' }, { status: 401 });
    }

    // Lê o corpo da requisição que o QStash enviou
    const bodyText = await request.text();
    const isValid = await receiver.verify({ signature, body: bodyText });

    if (!isValid) {
      logger.error(`${TAG} Assinatura QStash inválida recebida.`);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
    logger.info(`${TAG} Assinatura QStash verificada com sucesso.`);

    // 2. Extrair userId do corpo da requisição
    let payload: any;
    try {
        payload = JSON.parse(bodyText);
        userId = payload?.userId; // Assume que o corpo JSON tem uma chave 'userId'
    } catch (parseError) {
        logger.error(`${TAG} Erro ao parsear corpo da requisição JSON:`, parseError);
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!userId || typeof userId !== 'string' || !mongoose.isValidObjectId(userId)) {
        logger.error(`${TAG} 'userId' ausente, inválido ou não é um ObjectId no corpo da requisição: ${userId}`);
        return NextResponse.json({ error: 'Missing or invalid userId in request body' }, { status: 400 });
    }

    logger.info(`${TAG} Recebida tarefa para atualizar dados do User ID: ${userId}`);

    // 3. Chamar a função principal de atualização de dados
    const refreshResult = await triggerDataRefresh(userId);

    // 4. Logar e retornar o resultado
    if (refreshResult.success) {
        logger.info(`${TAG} Atualização de dados para User ${userId} concluída com sucesso. Mensagem: ${refreshResult.message}`);
        return NextResponse.json({ success: true, message: refreshResult.message, details: refreshResult.details }, { status: 200 });
    } else {
        logger.error(`${TAG} Falha na atualização de dados para User ${userId}. Mensagem: ${refreshResult.message}`);
        // Retorna 200 para QStash não tentar reenviar automaticamente por falha na lógica de negócio,
        // mas indica a falha no corpo da resposta. Se fosse um erro 5xx, QStash tentaria reenviar.
        return NextResponse.json({ success: false, message: refreshResult.message, details: refreshResult.details }, { status: 200 });
    }

  } catch (error) {
    logger.error(`${TAG} Erro GERAL não tratado no Worker para User ${userId ?? 'ID desconhecido'}:`, error);
    // Retorna 500 para erro inesperado, QStash pode tentar reenviar.
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
