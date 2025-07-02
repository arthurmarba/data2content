import { NextRequest, NextResponse } from 'next/server';
import { Receiver } from "@upstash/qstash";
import { Client as QStashClient } from "@upstash/qstash";
import { logger } from '@/app/lib/logger';
import { connectToDatabase } from '@/app/lib/mongoose'; // Supondo o caminho
import MetricModel from '@/app/models/Metric'; // Modelo onde os posts estão

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// --- INICIALIZAÇÃO DO QSTASH ---
const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
const qstashToken = process.env.QSTASH_TOKEN;
// URL da nova rota trabalhadora que processará cada post
const workerUrl = `${process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL}/api/worker/backfill-post-cover`;

let receiver: Receiver | null = null;
let qstashClient: QStashClient | null = null;
let initError: string | null = null;

if (!currentSigningKey || !nextSigningKey) {
    initError = "Chaves de assinatura QStash (CURRENT ou NEXT) não definidas no ambiente.";
    logger.error(`[Cron BackfillPostCovers Init] ${initError}`);
} else {
    receiver = new Receiver({
        currentSigningKey: currentSigningKey,
        nextSigningKey: nextSigningKey,
    });
}

if (!qstashToken) {
    initError = (initError ? initError + " e " : "") + "QSTASH_TOKEN não definido no ambiente.";
    logger.error(`[Cron BackfillPostCovers Init] ${initError}`);
} else {
    qstashClient = new QStashClient({ token: qstashToken });
}

if (!workerUrl.startsWith('http')) {
     initError = (initError ? initError + " e " : "") + "URL do worker inválida (APP_BASE_URL ou NEXT_PUBLIC_APP_URL não definido corretamente).";
     logger.error(`[Cron BackfillPostCovers Init] ${initError}`);
}

if (receiver && qstashClient && workerUrl.startsWith('http')) {
     logger.info(`[Cron BackfillPostCovers Init] QStash Receiver e Client inicializados. Worker URL: ${workerUrl}`);
}
// --- FIM DA INICIALIZAÇÃO ---


/**
 * POST /api/cron/backfill-post-covers
 * Endpoint chamado pelo agendador para enfileirar tarefas de preenchimento
 * de capas de posts que estão faltando.
 */
export async function POST(request: NextRequest) {
  const TAG = '[Cron BackfillPostCovers]';

  if (!receiver || !qstashClient || !workerUrl.startsWith('http')) {
      logger.error(`${TAG} Erro na inicialização dos clientes/configuração: ${initError}`);
      return NextResponse.json({ error: `Configuration error: ${initError}` }, { status: 500 });
  }

  try {
    // 1. Verificar Assinatura QStash para segurança
    const signature = request.headers.get('upstash-signature');
    if (signature) {
        const bodyText = await request.text();
        const isValid = await receiver.verify({ signature, body: bodyText });
        if (!isValid) {
          logger.error(`${TAG} Assinatura QStash inválida.`);
          return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }
        logger.info(`${TAG} Assinatura QStash verificada.`);
    } else {
        logger.warn(`${TAG} Header 'upstash-signature' ausente. Prosseguindo (assumindo chamada de Vercel Cron ou outra verificação segura).`);
    }

    // 2. Conectar ao Banco de Dados
    await connectToDatabase();
    logger.debug(`${TAG} Conectado ao banco de dados.`);

    // 3. Buscar Posts que precisam de uma capa
    // A query busca posts que TÊM um 'instagramMediaId', mas NÃO TÊM uma 'coverUrl'.
    const postsToProcess = await MetricModel.find({
        instagramMediaId: { $ne: null, $exists: true },
        coverUrl: { $eq: null }
    }).select('_id').lean();

    logger.info(`${TAG} Encontrados ${postsToProcess.length} posts para preencher a capa.`);

    if (postsToProcess.length === 0) {
        logger.info(`${TAG} Nenhum post elegível encontrado. Encerrando.`);
        return NextResponse.json({ success: true, message: "No eligible posts found." }, { status: 200 });
    }

    // 4. Enfileirar Tarefas Individuais no QStash para cada post
    let publishedCount = 0;
    let failedCount = 0;

    for (const post of postsToProcess) {
        const postId = post._id.toString();
        const payload = { postId }; // Corpo da mensagem para o worker

        try {
            logger.debug(`${TAG} Publicando tarefa de backfill para Post ${postId}...`);
            await qstashClient.publishJSON({
                url: workerUrl,
                body: payload,
            });
            publishedCount++;
        } catch (qstashError) {
            failedCount++;
            logger.error(`${TAG} Falha ao publicar tarefa no QStash para Post ${postId}:`, qstashError);
        }
    }

    logger.info(`${TAG} Processamento concluído. Tarefas publicadas: ${publishedCount}. Falhas: ${failedCount}.`);
    return NextResponse.json({ success: true, published: publishedCount, failed: failedCount }, { status: 200 });

  } catch (error) {
    logger.error(`${TAG} Erro GERAL não tratado na API Cron Trigger:`, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}