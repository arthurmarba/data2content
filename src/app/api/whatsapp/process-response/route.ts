// src/app/api/whatsapp/process-response/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Receiver } from "@upstash/qstash";
import { logger } from '@/app/lib/logger';
// Importar stateService para limpeza de estado em erro muito genérico, se necessário, mas handlers devem cuidar disso.
// import * as stateService from '@/app/lib/stateService';
import { handleDailyTip } from './dailyTipHandler';
import { handleUserMessage } from './userMessageHandler';
import { ProcessRequestBody } from './types'; // Tipos locais da rota

export const runtime = 'nodejs'; // Garante que estamos usando o runtime Node.js para compatibilidade com QStash SDK e outras libs.

const ROUTE_TAG = '[API Route /process-response]';

// Configuração do QStash Receiver
const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
let receiver: Receiver | null = null;

if (currentSigningKey && nextSigningKey) {
    try {
        receiver = new Receiver({
            currentSigningKey: currentSigningKey,
            nextSigningKey: nextSigningKey,
        });
    } catch (e) {
        logger.error(`${ROUTE_TAG} Erro ao inicializar QStash Receiver:`, e);
        // Considerar uma forma de notificar ou impedir a aplicação de iniciar se for crítico.
    }
} else {
    logger.error(
        `${ROUTE_TAG} Chaves de assinatura QStash (QSTASH_CURRENT_SIGNING_KEY, QSTASH_NEXT_SIGNING_KEY) não definidas nas variáveis de ambiente.`
    );
    // Sem o receiver, a rota não pode verificar mensagens, então pode ser útil logar um erro crítico.
}

export async function POST(request: NextRequest): Promise<NextResponse> {
    if (!receiver) {
        logger.error(`${ROUTE_TAG} QStash Receiver não está inicializado. Verifique as chaves de assinatura.`);
        return NextResponse.json({ error: 'QStash Receiver not configured or initialization failed' }, { status: 500 });
    }

    let bodyText: string;
    let payload: ProcessRequestBody | undefined = undefined;
    let qstashMessageIdForLog: string | undefined = undefined; // Para logs de erro de alto nível

    try {
        // 1. Obter o corpo da requisição como texto
        bodyText = await request.text();

        // 2. Verificar a assinatura do QStash
        const signature = request.headers.get('upstash-signature');
        if (!signature) {
            logger.warn(`${ROUTE_TAG} Cabeçalho de assinatura 'upstash-signature' ausente.`);
            return NextResponse.json({ error: 'Missing QStash signature header' }, { status: 401 });
        }

        const isValid = await receiver.verify({ signature, body: bodyText });
        if (!isValid) {
            logger.warn(`${ROUTE_TAG} Assinatura QStash inválida.`);
            return NextResponse.json({ error: 'Invalid QStash signature' }, { status: 401 });
        }
        logger.info(`${ROUTE_TAG} Assinatura QStash verificada com sucesso.`);

        // 3. Parsear o payload (corpo da requisição)
        try {
            payload = JSON.parse(bodyText) as ProcessRequestBody;
            // Validação básica do payload
            if (!payload || typeof payload !== 'object' || !payload.userId) {
                logger.error(`${ROUTE_TAG} Payload inválido ou userId ausente. Payload recebido: ${bodyText.slice(0, 500)}`);
                return NextResponse.json({ error: 'Invalid payload structure or missing userId' }, { status: 400 });
            }
            qstashMessageIdForLog = payload.qstashMessageId || `internalNoQId_${payload.userId}_${Date.now()}`;
            logger.info(`${ROUTE_TAG} Processando MsgID QStash (ou interno): ${qstashMessageIdForLog}, UserID: ${payload.userId}, TaskType: ${payload.taskType || 'user_message'}`);
        } catch (parseError: any) {
            logger.error(`${ROUTE_TAG} Erro ao parsear o corpo da requisição JSON: ${parseError.message}. BodyText (início): ${bodyText.slice(0, 200)}`);
            return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
        }

        // 4. Delegar para o handler apropriado
        if (payload.taskType === "daily_tip") {
            return await handleDailyTip(payload);
        } else {
            // Assume que qualquer outra taskType, ou a ausência dela, é uma mensagem de usuário normal
            return await handleUserMessage(payload);
        }

    } catch (error: any) {
        // Este bloco catch lida com erros que podem ocorrer *antes* da delegação para os handlers
        // ou erros não tratados que borbulham dos handlers (embora eles devam tratar seus próprios erros).
        const topLevelErrorMsgId = qstashMessageIdForLog || 'N/A_NO_PAYLOAD_PARSE';
        logger.error(`${ROUTE_TAG} Erro GERAL não tratado na rota principal (MsgID: ${topLevelErrorMsgId}):`, error);

        // A limpeza de estado (como currentProcessingMessageId) deve ser primariamente responsabilidade
        // dos handlers individuais, pois eles têm mais contexto.
        // Uma limpeza genérica aqui pode ser arriscada se o erro ocorreu muito cedo.
        // Exemplo de tentativa de limpeza (comentado por segurança, requer `stateService`):
        /*
        if (payload && payload.userId && topLevelErrorMsgId !== 'N/A_NO_PAYLOAD_PARSE') {
            try {
                // Cuidado: currentProcessingMessageId pode não ter sido setado se o erro foi antes.
                // Ou pode ter sido setado por um handler que falhou.
                // A lógica de qual ID limpar é complexa em um erro genérico de alto nível.
                const errorState = await stateService.getDialogueState(payload.userId);
                if (errorState.currentProcessingMessageId) { // Verifica se há algum ID sendo processado
                     logger.warn(`${ROUTE_TAG} Tentando limpar estado para ${payload.userId} devido a erro geral. ID em processamento no estado: ${errorState.currentProcessingMessageId}. ID da mensagem com erro: ${topLevelErrorMsgId}`);
                     // Idealmente, o ID da mensagem com erro deveria ser usado para limpar, mas pode não ser o que está no estado.
                     // await stateService.updateDialogueState(payload.userId, { currentProcessingMessageId: null, currentProcessingQueryExcerpt: null });
                }
            } catch (cleanupError) {
                logger.error(`${ROUTE_TAG} Erro ao tentar limpar estado de processamento para UserID ${payload.userId} após erro geral:`, cleanupError);
            }
        }
        */
        return NextResponse.json({ error: 'Internal server error processing the request at the top level.' }, { status: 500 });
    }
}