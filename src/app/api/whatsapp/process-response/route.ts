// src/app/api/whatsapp/process-response/route.ts

import { NextRequest, NextResponse } from 'next/server';
// --- CORREÇÃO NA IMPORTAÇÃO (Tentativa 3) ---
import { Receiver } from "@upstash/qstash"; // Tenta importar Receiver do core @upstash/qstash
// --- FIM DA CORREÇÃO ---
import { logger } from '@/app/lib/logger';
import { sendWhatsAppMessage } from '@/app/lib/whatsappService';
import { askLLMWithEnrichedContext } from '@/app/lib/aiOrchestrator';
import * as stateService from '@/app/lib/stateService';
import * as dataService from '@/app/lib/dataService'; // Assumindo que lookupUserById existe ou será criado
import { IUser } from '@/app/models/User';
import { AggregatedReport } from '@/app/lib/reportHelpers';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

export const runtime = 'nodejs'; // Ou 'edge' se compatível com dependências

// Define a estrutura esperada do corpo da requisição vinda do QStash
interface ProcessRequestBody {
  fromPhone: string;
  incomingText: string;
  userId: string;
  // Poderia incluir userName, etc., se enviado pela API 'incoming'
}

// Configurações (podem vir do .env ou ser definidas aqui)
const STREAM_READ_TIMEOUT_MS = Number(process.env.STREAM_READ_TIMEOUT_MS) || 90_000;
const HISTORY_LIMIT = Number(process.env.LLM_HISTORY_LIMIT) || 10;
const CACHE_TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS) || 60 * 5;

// --- INICIALIZAÇÃO DO QSTASH RECEIVER ---
// Verifica se as chaves de assinatura estão definidas no ambiente
const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;

if (!currentSigningKey || !nextSigningKey) {
    logger.error("[QStash Worker Init] Chaves de assinatura QStash (CURRENT ou NEXT) não definidas no ambiente.");
    // Lança um erro ou define receiver como null para tratamento posterior
    // throw new Error("QStash signing keys not configured");
}

// Inicializa o Receiver (pode falhar se a importação estiver errada)
let receiver: Receiver | null = null;
try {
     if (currentSigningKey && nextSigningKey) {
        receiver = new Receiver({
            currentSigningKey: currentSigningKey,
            nextSigningKey: nextSigningKey,
        });
     }
} catch (initError) {
    logger.error("[QStash Worker Init] Falha ao inicializar QStash Receiver:", initError);
    // Mantém receiver como null
}
// --- FIM DA INICIALIZAÇÃO ---


/**
 * POST /api/whatsapp/process-response
 * Endpoint chamado pelo QStash para processar a resposta da IA e enviá-la.
 */
export async function POST(request: NextRequest) {
  const TAG = '[QStash Worker /process-response v1.4]'; // Tag atualizada

  // Verifica se o receiver foi inicializado corretamente
  if (!receiver) {
      logger.error(`${TAG} QStash Receiver não inicializado devido a chaves ausentes ou erro na importação.`);
      return NextResponse.json({ error: 'QStash Receiver not configured' }, { status: 500 });
  }

  try {
    // 1. Verificar Assinatura QStash (SEGURANÇA) usando Receiver
    // O método verify lê o corpo, então não o leia antes.
    const bodyText = await request.text(); // Lê o corpo como texto para verificação e parse posterior

    const signature = request.headers.get('upstash-signature');
    if (!signature) {
        logger.error(`${TAG} Header 'upstash-signature' ausente na requisição.`);
        return NextResponse.json({ error: 'Missing signature header' }, { status: 401 });
    }

    // Usando o método verify da instância do Receiver
    const isValid = await receiver.verify({
        signature: signature,
        body: bodyText,
        // url: request.url // Opcional: verificar URL também
    });

    if (!isValid) {
      logger.error(`${TAG} Assinatura inválida recebida.`);
      // O QStash recomenda retornar 401 para assinaturas inválidas
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
    logger.info(`${TAG} Assinatura QStash verificada com sucesso.`);

    // 2. Parse do Corpo (Payload da Tarefa)
    let payload: ProcessRequestBody;
    try {
      payload = JSON.parse(bodyText); // Parse o texto que já lemos
      // Validação básica do payload
      if (!payload.fromPhone || !payload.incomingText || !payload.userId) {
        throw new Error('Payload inválido: Faltam campos obrigatórios.');
      }
    } catch (e) {
      logger.error(`${TAG} Erro ao parsear o corpo JSON ou payload inválido:`, e);
      // Retorna 400 para QStash não tentar novamente com body inválido
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { fromPhone, incomingText, userId } = payload;
    logger.info(`${TAG} Processando tarefa para User: ${userId}, Phone: ${fromPhone.slice(-4)}...`);

    // 3. Carregar Dados Necessários (Usuário, Estado, Histórico, Relatório)
    let user: IUser;
    let dialogueState: stateService.DialogueState = {};
    let historyString: string = '';
    let latestReport: AggregatedReport | null = null;

    try {
      user = await dataService.lookupUserById(userId); // Busca por ID agora
      // Erro se usuário não encontrado já é lançado por lookupUserById

      [dialogueState, historyString, latestReport] = await Promise.all([
        stateService.getDialogueState(userId),
        stateService.getConversationHistory(userId),
        dataService.getLatestAggregatedReport(userId)
      ]);
      logger.debug(`${TAG} Dados carregados para User: ${userId}`);

    } catch (err) {
      logger.error(`${TAG} Erro ao carregar dados para User ${userId}:`, err);
      // Retorna 500 para QStash tentar novamente (pode ser erro temporário de DB)
      return NextResponse.json({ error: `Failed to load user data: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
    }

    // 4. Preparar Histórico Limitado
    let historyMessages: ChatCompletionMessageParam[] = [];
    if (historyString) {
        try {
            // (Lógica de parse do histórico)
            const lines = historyString.trim().split('\n');
            let currentRole: 'user' | 'assistant' | null = null;
            let currentContent = '';
            for (const line of lines) {
                if (line.startsWith('User: ')) { if (currentRole) historyMessages.push({ role: currentRole, content: currentContent.trim() }); currentRole = 'user'; currentContent = line.substring(6); }
                else if (line.startsWith('Assistant: ')) { if (currentRole) historyMessages.push({ role: currentRole, content: currentContent.trim() }); currentRole = 'assistant'; currentContent = line.substring(11); }
                else if (currentRole) { currentContent += '\n' + line; }
            }
            if (currentRole) historyMessages.push({ role: currentRole, content: currentContent.trim() });
        } catch (parseError) { logger.error(`${TAG} Erro ao parsear histórico para User ${userId}:`, parseError); historyMessages = []; }
    }
    const limitedHistoryMessages = historyMessages.slice(-HISTORY_LIMIT);
    logger.debug(`${TAG} Histórico preparado (limitado a ${limitedHistoryMessages.length} msgs).`);


    // 5. Preparar Contexto Enriquecido
    const enrichedContext = {
        user: user,
        historyMessages: limitedHistoryMessages,
        dialogueState: dialogueState,
        latestReport: latestReport,
    };

    // 6. Chamar a IA e Processar Resposta (Stream)
    let finalText = '';
    let historyFromLLM: ChatCompletionMessageParam[] = [];
    let readCounter = 0;
    let streamTimeout: NodeJS.Timeout | null = null;
    let reader: ReadableStreamDefaultReader<string> | null = null;

    try {
        logger.debug(`${TAG} Chamando askLLMWithEnrichedContext para User ${userId}...`);
        const { stream, history: updatedHistory } = await askLLMWithEnrichedContext(
            enrichedContext,
            incomingText
        );
        historyFromLLM = updatedHistory;
        logger.debug(`${TAG} askLLMWithEnrichedContext retornou para User ${userId}. Lendo stream...`);

        reader = stream.getReader();
        streamTimeout = setTimeout(() => {
            logger.warn(`${TAG} Timeout (${STREAM_READ_TIMEOUT_MS}ms) durante leitura do stream para User ${userId}. Cancelando reader.`);
            streamTimeout = null;
            reader?.cancel(`Stream reading timeout after ${STREAM_READ_TIMEOUT_MS}ms`).catch(e => logger.error(`${TAG} Erro ao cancelar reader no timeout:`, e));
        }, STREAM_READ_TIMEOUT_MS);

        while (true) {
            // (Loop de leitura do stream)
            readCounter++;
            let value: string | undefined; let done: boolean | undefined;
            try {
                const result = await reader.read();
                if (streamTimeout === null && !result.done) { logger.warn(`${TAG} [Leitura ${readCounter}] Leitura retornou após timeout/cancelamento, ignorando chunk.`); continue; }
                value = result.value; done = result.done;
            } catch (readError: any) { logger.error(`${TAG} [Leitura ${readCounter}] Erro em reader.read(): ${readError.message}`); if (streamTimeout) clearTimeout(streamTimeout); streamTimeout = null; throw new Error(`Erro ao ler stream: ${readError.message}`); }
            if (done) { logger.debug(`${TAG} [Leitura ${readCounter}] Stream finalizado (done=true).`); break; }
            if (typeof value === 'string') { finalText += value; }
            else { logger.warn(`${TAG} [Leitura ${readCounter}] Recebido 'value' undefined, mas 'done' é false.`); }
        }
        if (streamTimeout) { clearTimeout(streamTimeout); logger.debug(`${TAG} Leitura do stream concluída antes do timeout.`); }

        logger.debug(`${TAG} Texto final montado para User ${userId}: ${finalText.length} chars.`);

        if (finalText.trim().length === 0) {
            logger.warn(`${TAG} Stream finalizado mas finalText está vazio após ${readCounter} leituras para User ${userId}.`);
            finalText = 'Hum... não consegui gerar uma resposta completa agora. Pode tentar de novo ou reformular seu pedido?';
        }

    } catch (err: any) {
        logger.error(`${TAG} Erro durante chamada ao LLM ou leitura do stream para User ${userId} (após ${readCounter} leituras):`, err);
        if (streamTimeout) clearTimeout(streamTimeout); streamTimeout = null;
        finalText = 'Ops! Tive uma dificuldade técnica aqui ao gerar a resposta final. A equipa já foi notificada. 🙏';
    } finally {
        if (reader) {
            try { await reader.releaseLock(); }
            catch (releaseError) { logger.error(`${TAG} Erro (não fatal) ao liberar reader lock no finally:`, releaseError); }
        }
    }

    // 7. Enviar Resposta Final ao Utilizador
    try {
        logger.info(`${TAG} Enviando resposta final (${finalText.length} chars) para ${fromPhone}...`);
        await sendWhatsAppMessage(fromPhone, finalText);
        logger.info(`${TAG} Resposta final enviada com sucesso para ${fromPhone}.`);
    } catch (sendError) {
        logger.error(`${TAG} Falha CRÍTICA ao enviar resposta final para ${fromPhone}:`, sendError);
        // Retorna 500 para QStash tentar novamente
        return NextResponse.json({ error: `Failed to send final WhatsApp message: ${sendError instanceof Error ? sendError.message : String(sendError)}` }, { status: 500 });
    }

    // 8. Persistir Estado/Histórico/Cache (Após envio bem-sucedido)
    try {
        logger.debug(`${TAG} Iniciando persistência no Redis para User ${userId}...`);
        const nextState = { ...(dialogueState || {}), lastInteraction: Date.now() };
        const cacheKey = `resp:${fromPhone}:${incomingText.trim().slice(0, 100)}`;

        // (Lógica para salvar histórico)
        const newHistoryString = historyFromLLM
            .filter(msg => msg.role === 'user' || (msg.role === 'assistant' && typeof msg.content === 'string' && msg.content.trim().length > 0))
            .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}`)
            .join('\n');

        await Promise.allSettled([
            stateService.updateDialogueState(userId, nextState),
            stateService.setConversationHistory(userId, newHistoryString),
            stateService.setInCache(cacheKey, finalText, CACHE_TTL_SECONDS),
            stateService.incrementUsageCounter(userId),
        ]);
        logger.debug(`${TAG} Persistência no Redis concluída para User ${userId}.`);
    } catch (persistError) {
        logger.error(`${TAG} Erro durante a persistência no Redis (não fatal) para User ${userId}:`, persistError);
    }

    // 9. Retornar Sucesso para QStash
    logger.info(`${TAG} Tarefa concluída com sucesso para User ${userId}.`);
    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error) {
    // Captura erros gerais não tratados (ex: falha na verificação inicial, erro crítico)
    logger.error(`${TAG} Erro GERAL não tratado na API worker:`, error);
    // Retorna 500 para QStash tentar novamente
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
