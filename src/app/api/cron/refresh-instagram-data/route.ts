import { NextRequest, NextResponse } from 'next/server';
import { Receiver } from "@upstash/qstash"; // Para verificar chamadas do QStash Scheduler
import { Client as QStashClient } from "@upstash/qstash"; // Para publicar tarefas
import { logger } from '@/app/lib/logger';
import { connectToDatabase } from '@/app/lib/mongoose';
import User from '@/app/models/User'; // Importa o modelo User padrão
import { invalidateDashboardPlatformSummaryCaches } from '@/app/lib/cache/dashboardCache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // Garante execução dinâmica

// --- INICIALIZAÇÃO DO QSTASH RECEIVER e CLIENT ---
const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
const qstashToken = process.env.QSTASH_TOKEN;
// URL da rota trabalhadora que processará cada usuário individualmente
const workerUrl = `${process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL}/api/worker/refresh-instagram-user`;

let receiver: Receiver | null = null;
let qstashClient: QStashClient | null = null;
let initError: string | null = null;

if (!currentSigningKey || !nextSigningKey) {
    initError = "Chaves de assinatura QStash (CURRENT ou NEXT) não definidas no ambiente.";
    logger.error(`[Cron RefreshInstagramData Init] ${initError}`);
} else {
    receiver = new Receiver({
        currentSigningKey: currentSigningKey,
        nextSigningKey: nextSigningKey,
    });
}

if (!qstashToken) {
    initError = (initError ? initError + " e " : "") + "QSTASH_TOKEN não definido no ambiente.";
    logger.error(`[Cron RefreshInstagramData Init] ${initError}`);
} else {
    qstashClient = new QStashClient({ token: qstashToken });
}

if (!workerUrl.startsWith('http')) {
     initError = (initError ? initError + " e " : "") + "URL do worker inválida (APP_BASE_URL ou NEXT_PUBLIC_APP_URL não definido corretamente).";
     logger.error(`[Cron RefreshInstagramData Init] ${initError}`);
}

if (receiver && qstashClient && workerUrl.startsWith('http')) {
     logger.info(`[Cron RefreshInstagramData Init] QStash Receiver e Client inicializados. Worker URL: ${workerUrl}`);
}
// --- FIM DA INICIALIZAÇÃO ---


/**
 * POST /api/cron/refresh-instagram-data
 * Endpoint chamado pelo QStash Scheduler (ou outro cron) para enfileirar
 * tarefas de atualização de dados do Instagram para todos os usuários conectados.
 */
export async function POST(request: NextRequest) {
  const TAG = '[Cron RefreshInstagramData]';
  const cronSecret = process.env.CRON_SECRET;

  // Verifica se houve erro na inicialização
  if (!receiver || !qstashClient || !workerUrl.startsWith('http')) {
      logger.error(`${TAG} Erro na inicialização dos clientes/configuração: ${initError}`);
      return NextResponse.json({ error: `Configuration error: ${initError}` }, { status: 500 });
  }

  try {
    // 1. Verificar Assinatura QStash (SEGURANÇA - se chamado pelo QStash Scheduler)
    // Se for chamado por Vercel Cron, você pode querer outra forma de segurança (ex: Bearer token)
    const signature = request.headers.get('upstash-signature');
    if (!signature) {
        const cronHeader = request.headers.get('x-cron-key');
        if (!cronSecret || cronHeader !== cronSecret) {
          logger.error(`${TAG} Header 'upstash-signature' ausente e x-cron-key inválido.`);
          return NextResponse.json({ error: 'Unauthorized cron call' }, { status: 401 });
        }
        logger.info(`${TAG} Chamada autorizada via x-cron-key.`);
    } else {
        const bodyText = await request.text(); // Corpo pode ser vazio
        const isValid = await receiver.verify({ signature, body: bodyText });
        if (!isValid) {
          logger.error(`${TAG} Assinatura QStash inválida recebida.`);
          return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }
        logger.info(`${TAG} Assinatura QStash verificada com sucesso.`);
    }


    // 2. Conectar ao Banco de Dados
    await connectToDatabase();
    logger.debug(`${TAG} Conectado ao banco de dados.`);

    // 3. Buscar Usuários com Conexão Instagram Ativa
    const connectedUsers = await User.find({
        isInstagramConnected: true,
        instagramAccessToken: { $ne: null, $exists: true }, // Garante que o token existe
        instagramAccountId: { $ne: null, $exists: true } // Garante que o ID da conta existe
    }).select('_id').lean(); // Seleciona apenas o ID

    logger.info(`${TAG} Encontrados ${connectedUsers.length} usuários com conexão Instagram ativa.`);

    if (connectedUsers.length === 0) {
        logger.info(`${TAG} Nenhum usuário elegível encontrado. Encerrando.`);
        return NextResponse.json({ success: true, message: "No eligible users found." }, { status: 200 });
    }

    // 4. Enfileirar Tarefas Individuais no QStash para cada usuário
    let publishedCount = 0;
    let failedCount = 0;

    for (const user of connectedUsers) {
        const userId = user._id.toString();
        const payload = { userId: userId }; // Corpo da mensagem para o worker

        try {
            logger.debug(`${TAG} Publicando tarefa de refresh para User ${userId}...`);
            await qstashClient.publishJSON({
                url: workerUrl, // A URL da nossa rota trabalhadora
                body: payload,
                // Opcional: Adicionar um delay escalonado para distribuir a carga
                // delay: `${publishedCount * 5}s`, // Ex: 0s, 5s, 10s...
                // Opcional: Definir retentativas em caso de falha do worker (ex: erro 5xx)
                // retries: 2,
            });
            publishedCount++;
        } catch (qstashError) {
            failedCount++;
            logger.error(`${TAG} Falha ao publicar tarefa no QStash para User ${userId}:`, qstashError);
            // Continua para os próximos usuários
        }
    }

    if (publishedCount > 0) {
      invalidateDashboardPlatformSummaryCaches();
      logger.info(`${TAG} Cache de platform summary invalidado após enfileirar refresh de usuários.`);
    }

    logger.info(`${TAG} Processamento concluído. Tarefas publicadas: ${publishedCount}. Falhas: ${failedCount}.`);
    return NextResponse.json({ success: true, published: publishedCount, failed: failedCount }, { status: 200 });

  } catch (error) {
    logger.error(`${TAG} Erro GERAL não tratado na API Cron Trigger:`, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
