// src/app/api/cron/send-daily-tips/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { Receiver } from "@upstash/qstash"; // Importa o Receiver QStash
import { Client as QStashClient } from "@upstash/qstash"; // Importa o Cliente QStash
import { logger } from '@/app/lib/logger';
import { connectToDatabase } from '@/app/lib/mongoose';
import User, { IUser } from '@/app/models/User';
import { isActiveLike, type ActiveLikeStatus } from '@/app/lib/isActiveLike';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // Garante que a função execute dinamicamente a cada chamada

// --- INICIALIZAÇÃO DO QSTASH RECEIVER e CLIENT ---
// Verifica se as chaves de assinatura estão definidas no ambiente
const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
const qstashToken = process.env.QSTASH_TOKEN;
const appBaseUrl = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;

let receiver: Receiver | null = null;
let qstashClient: QStashClient | null = null;
let initError: string | null = null;

if (!currentSigningKey || !nextSigningKey) {
    initError = "Chaves de assinatura QStash (CURRENT ou NEXT) não definidas no ambiente.";
    logger.error(`[Cron SendDailyTips Init] ${initError}`);
} else {
    receiver = new Receiver({
        currentSigningKey: currentSigningKey,
        nextSigningKey: nextSigningKey,
    });
}

if (!qstashToken) {
    initError = (initError ? initError + " e " : "") + "QSTASH_TOKEN não definido no ambiente.";
    logger.error(`[Cron SendDailyTips Init] ${initError}`);
} else {
    qstashClient = new QStashClient({ token: qstashToken });
}

if (!appBaseUrl) {
    initError = (initError ? initError + " e " : "") + "APP_BASE_URL ou NEXT_PUBLIC_APP_URL não definido no ambiente.";
    logger.error(`[Cron SendDailyTips Init] ${initError}`);
}
// --- FIM DA INICIALIZAÇÃO ---


/**
 * POST /api/cron/send-daily-tips
 * Endpoint chamado pelo QStash Cron Job para enfileirar tarefas de envio de dicas.
 */
export async function POST(request: NextRequest) {
  const TAG = '[Cron SendDailyTips]';

  // Verifica se houve erro na inicialização
  if (!receiver || !qstashClient || !appBaseUrl) {
      logger.error(`${TAG} Erro na inicialização dos clientes/configuração: ${initError}`);
      return NextResponse.json({ error: `Configuration error: ${initError}` }, { status: 500 });
  }

  try {
    // 1. Verificar Assinatura QStash (SEGURANÇA)
    const signature = request.headers.get('upstash-signature');
    if (!signature) {
        logger.error(`${TAG} Header 'upstash-signature' ausente.`);
        return NextResponse.json({ error: 'Missing signature header' }, { status: 401 });
    }
    // O corpo pode estar vazio em chamadas de cron, mas a verificação ainda é necessária
    const bodyText = await request.text();
    const isValid = await receiver.verify({ signature, body: bodyText });

    if (!isValid) {
      logger.error(`${TAG} Assinatura inválida recebida do Cron Job.`);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
    logger.info(`${TAG} Assinatura QStash verificada com sucesso. Iniciando busca de usuários...`);

    // 2. Conectar ao Banco de Dados
    await connectToDatabase();
    logger.debug(`${TAG} Conectado ao banco de dados.`);

    // 3. Buscar Usuários Ativos com WhatsApp Verificado
    const activeLikeStatuses: ActiveLikeStatus[] = [
        'active',
        'non_renewing',
        'trial',
        'trialing',
    ].filter(isActiveLike);

    const activeUsers = await User.find({
        planStatus: { $in: activeLikeStatuses },
        whatsappPhone: { $ne: null, $exists: true }, // Garante que o campo existe e não é null
        whatsappVerified: true, // Garante que o número foi verificado
        whatsappTrialActive: { $ne: true }, // Evita criadores no trial de 48h
    })
      .select('_id name')
      .lean(); // Seleciona apenas o ID e nome

    logger.info(`${TAG} Encontrados ${activeUsers.length} usuários com plano ativo-like e WhatsApp verificado para receber dicas.`);

    if (activeUsers.length === 0) {
        logger.info(`${TAG} Nenhum usuário elegível encontrado. Encerrando.`);
        return NextResponse.json({ success: true, message: "No eligible users found." }, { status: 200 });
    }

    // 4. Enfileirar Tarefas Individuais no QStash
    const workerUrl = `${appBaseUrl}/api/whatsapp/process-response`;
    let publishedCount = 0;
    let failedCount = 0;

    for (const user of activeUsers) {
        const userId = user._id.toString();
        const payload = {
            taskType: "daily_tip", // Identificador da tarefa
            userId: userId
            // Não precisamos enviar fromPhone ou incomingText aqui
        };

        try {
            logger.debug(`${TAG} Publicando tarefa 'daily_tip' para User ${userId}...`);
            await qstashClient.publishJSON({
                url: workerUrl,
                body: payload,
                // Opcional: Adicionar um delay escalonado para não sobrecarregar o worker
                // delay: `${publishedCount * 2}s`, // Ex: 0s, 2s, 4s...
            });
            publishedCount++;
        } catch (qstashError) {
            failedCount++;
            logger.error(`${TAG} Falha ao publicar tarefa no QStash para User ${userId}:`, qstashError);
            // Continua para os próximos usuários
        }
    }

    logger.info(`${TAG} Processamento concluído. Tarefas publicadas: ${publishedCount}. Falhas: ${failedCount}.`);
    return NextResponse.json({ success: true, published: publishedCount, failed: failedCount }, { status: 200 });

  } catch (error) {
    logger.error(`${TAG} Erro GERAL não tratado na API Cron:`, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
