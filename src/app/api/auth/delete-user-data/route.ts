// src/app/api/auth/delete-user-data/route.ts
// Rota para lidar com o Callback de Solicitação de Exclusão de Dados do Facebook.

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { connectToDatabase } from '@/app/lib/mongoose';
import DbUser, { IUser } from '@/app/models/User';
import MetricModel from '@/app/models/Metric';
import AccountInsightModel from '@/app/models/AccountInsight';
import DailyMetricSnapshotModel from '@/app/models/DailyMetricSnapshot';
import StoryMetricModel from '@/app/models/StoryMetric';
import { logger } from '@/app/lib/logger';
import { Types } from 'mongoose';

const TAG = '[API /auth/delete-user-data]';

interface SignedRequestPayload {
  algorithm: string;
  issued_at: number;
  user_id: string; // ID do usuário do Facebook
  // Outros campos podem estar presentes dependendo do contexto (ex: oauth_token, expires_in)
}

/**
 * Decodifica e verifica a signed_request do Facebook.
 * @param signedRequest - A string da signed_request.
 * @param appSecret - O segredo do seu aplicativo Facebook.
 * @returns O payload decodificado se a assinatura for válida, caso contrário null.
 */
function parseSignedRequest(signedRequest: string, appSecret: string): SignedRequestPayload | null {
    try {
        const [encodedSig, payload] = signedRequest.split('.', 2);

        if (!encodedSig || !payload) {
            logger.error(`${TAG} Formato inválido da signed_request.`);
            return null;
        }

        // Decodifica a assinatura
        const sig = Buffer.from(encodedSig.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

        // Decodifica o payload
        const data = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8'));

        // Verifica o algoritmo
        if (!data.algorithm || data.algorithm.toUpperCase() !== 'HMAC-SHA256') {
            logger.error(`${TAG} Algoritmo desconhecido ou não suportado: ${data.algorithm}`);
            return null;
        }

        // Verifica a assinatura
        const expectedSig = crypto.createHmac('sha256', appSecret).update(payload).digest();

        if (sig.length !== expectedSig.length || !crypto.timingSafeEqual(sig, expectedSig)) {
            logger.error(`${TAG} Assinatura da signed_request inválida.`);
            return null;
        }

        return data as SignedRequestPayload;
    } catch (error) {
        logger.error(`${TAG} Erro ao parsear signed_request:`, error);
        return null;
    }
}

export async function POST(request: NextRequest) {
    logger.info(`${TAG} Recebida requisição POST para exclusão de dados.`);

    const appSecret = process.env.FACEBOOK_CLIENT_SECRET;
    if (!appSecret) {
        logger.error(`${TAG} FACEBOOK_CLIENT_SECRET não está definido. Impossível validar a solicitação.`);
        return NextResponse.json({ error: 'Configuração do servidor incompleta.' }, { status: 500 });
    }

    try {
        const formData = await request.formData();
        const signedRequest = formData.get('signed_request') as string | null;

        if (!signedRequest) {
            logger.warn(`${TAG} Parâmetro 'signed_request' ausente na requisição.`);
            return NextResponse.json({ error: "Parâmetro 'signed_request' obrigatório." }, { status: 400 });
        }

        logger.debug(`${TAG} Signed request recebida (início): ${signedRequest.substring(0, 20)}...`);

        const decodedPayload = parseSignedRequest(signedRequest, appSecret);

        if (!decodedPayload || !decodedPayload.user_id) {
            logger.error(`${TAG} Falha ao decodificar ou verificar signed_request, ou user_id ausente.`);
            return NextResponse.json({ error: 'Solicitação inválida ou não autenticada.' }, { status: 400 });
        }

        const facebookUserId = decodedPayload.user_id;
        logger.info(`${TAG} Solicitação de exclusão de dados validada para Facebook User ID: ${facebookUserId}`);

        await connectToDatabase();

        // 1. Encontrar o usuário no seu DB pelo facebookProviderAccountId
        const user: IUser | null = await DbUser.findOne({ facebookProviderAccountId: facebookUserId });

        if (!user) {
            logger.warn(`${TAG} Usuário com facebookProviderAccountId ${facebookUserId} não encontrado no DB. Nenhuma ação de exclusão realizada.`);
            // Mesmo se o usuário não for encontrado, o Facebook espera uma resposta de sucesso.
            // Gere um código de confirmação para indicar que a solicitação foi processada.
            const confirmationCodeNotFound = `notfound-${facebookUserId}-${Date.now()}`;
             // A URL de status pode ser uma página genérica ou um endpoint que você cria para rastrear
            const statusUrlNotFound = `${process.env.NEXTAUTH_URL}/data-deletion-status?code=${confirmationCodeNotFound}`;
            return NextResponse.json({ url: statusUrlNotFound, confirmation_code: confirmationCodeNotFound });
        }

        const internalUserId = user._id; // Este é o Types.ObjectId
        logger.info(`${TAG} Usuário encontrado no DB com ID interno: ${internalUserId}. Iniciando exclusão de dados...`);

        // 2. Deletar dados associados de outras coleções
        // Estas operações podem ser encapsuladas em uma transação se o seu DB suportar
        await MetricModel.deleteMany({ user: internalUserId });
        logger.debug(`${TAG} Métricas deletadas para User ID: ${internalUserId}`);

        await AccountInsightModel.deleteMany({ user: internalUserId });
        logger.debug(`${TAG} Insights de conta deletados para User ID: ${internalUserId}`);

        await DailyMetricSnapshotModel.deleteMany({ metric: { $in: await MetricModel.find({ user: internalUserId }).distinct('_id') } });
        // Alternativamente, se DailyMetricSnapshotModel tiver um campo 'user' direto:
        // await DailyMetricSnapshotModel.deleteMany({ user: internalUserId });
        logger.debug(`${TAG} Snapshots diários de métricas deletados para User ID: ${internalUserId}`);

        await StoryMetricModel.deleteMany({ user: internalUserId });
        logger.debug(`${TAG} Métricas de story deletadas para User ID: ${internalUserId}`);

        // 3. Deletar o próprio usuário
        await DbUser.deleteOne({ _id: internalUserId });
        logger.info(`${TAG} Documento do usuário ${internalUserId} deletado do DB.`);

        // 4. Responder ao Facebook
        const confirmationCode = `${internalUserId}-${Date.now()}`;
        // A URL de status é uma URL que o usuário pode visitar para verificar o status da exclusão.
        // Você pode criar uma página simples para isso ou um endpoint que retorne o status.
        const statusUrl = `${process.env.NEXTAUTH_URL}/data-deletion-status?code=${confirmationCode}`;
        // Você pode querer salvar o confirmationCode e seu status em algum lugar para rastreamento.

        logger.info(`${TAG} Exclusão de dados concluída para Facebook User ID: ${facebookUserId} (Interno: ${internalUserId}). Código de confirmação: ${confirmationCode}`);

        return NextResponse.json({ url: statusUrl, confirmation_code: confirmationCode });

    } catch (error) {
        logger.error(`${TAG} Erro inesperado durante o processo de exclusão de dados:`, error);
        // Mesmo em caso de erro interno, é importante tentar responder ao Facebook,
        // embora possa não ser uma resposta de "sucesso" completa.
        return NextResponse.json({ error: 'Erro interno do servidor ao processar a solicitação de exclusão.' }, { status: 500 });
    }
}

// Opcional: Adicionar um handler GET para a URL de status
export async function GET(request: NextRequest) {
    const TAG_GET = '[GET /auth/delete-user-data]';
    const { searchParams } = new URL(request.url);
    const confirmationCode = searchParams.get('code');

    logger.info(`${TAG_GET} Rota de status de exclusão chamada com código: ${confirmationCode}`);

    if (confirmationCode) {
        // Aqui você implementaria a lógica para verificar o status do código de confirmação
        // Por exemplo, consultando um log de exclusões ou um status salvo no DB.
        // Por simplicidade, vamos apenas retornar uma mensagem genérica.
        return NextResponse.json({
            message: `Solicitação de exclusão com código ${confirmationCode} foi recebida e está sendo processada ou foi concluída.`,
            status: "pending_or_completed" // Ou o status real
        });
    }
    return NextResponse.json({ error: "Código de confirmação ausente." }, { status: 400 });
}
