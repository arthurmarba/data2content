// src/app/api/instagram/connect-selected-account/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { connectInstagramAccount } from '@/app/lib/instagram'; 
import { logger } from '@/app/lib/logger';
import mongoose from 'mongoose';
import User from '@/app/models/User';
import { connectToDatabase } from '@/app/lib/mongoose';
import { resolveAuthOptions } from '@/app/api/auth/resolveAuthOptions';
import {
  IG_RECONNECT_ERROR_CODES,
  type InstagramReconnectErrorCode,
  inferReconnectErrorCodeFromMessage,
} from '@/app/lib/instagram/reconnectErrors';
import {
  generateInstagramReconnectFlowId,
  INSTAGRAM_RECONNECT_FLOW_COOKIE_NAME,
  normalizeInstagramReconnectFlowId,
} from '@/app/lib/instagram/reconnectFlow';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; 

type RequestBody = {
  instagramAccountId?: string;
};

type SessionWithUserId = {
  user?: {
    id?: string;
  } | null;
} | null;

function errorResponse(
  errorCode: InstagramReconnectErrorCode,
  errorMessage: string,
  status: number,
  reconnectFlowId?: string | null
) {
  return NextResponse.json(
    {
      success: false,
      error: errorMessage,
      errorCode,
      errorMessage,
      reconnectFlowId: reconnectFlowId ?? null,
    },
    { status }
  );
}

export async function POST(request: NextRequest) {
  const TAG = '[API /instagram/connect-selected-account]';
  const reconnectFlowIdFromHeader = normalizeInstagramReconnectFlowId(
    request.headers.get('x-ig-reconnect-flow-id')
  );
  const reconnectFlowIdFromCookie = normalizeInstagramReconnectFlowId(
    request.cookies.get(INSTAGRAM_RECONNECT_FLOW_COOKIE_NAME)?.value
  );
  let reconnectFlowId = reconnectFlowIdFromHeader ?? reconnectFlowIdFromCookie ?? null;
  logger.info(`${TAG} Recebida requisição POST. flowId=${reconnectFlowId ?? 'none'}`);

  try {
    // 1. Obter a sessão do usuário
    const authOptions = await resolveAuthOptions();
    const sessionObject = (await getServerSession(authOptions)) as SessionWithUserId;

    // Validação robusta da sessão e do ID do usuário
    if (!sessionObject?.user?.id || !mongoose.Types.ObjectId.isValid(sessionObject.user.id)) {
      logger.warn(`${TAG} Tentativa de conectar conta sem sessão válida ou ID de usuário inválido. User ID: ${sessionObject?.user?.id}. flowId=${reconnectFlowId ?? 'none'}`);
      return errorResponse(
        IG_RECONNECT_ERROR_CODES.UNKNOWN,
        'Não autorizado. Sessão ou ID de usuário inválido.',
        401,
        reconnectFlowId
      );
    }
    const userId = sessionObject.user.id;

    // 2. Obter o instagramAccountId do corpo da requisição
    let requestBody: RequestBody;
    try {
      requestBody = await request.json();
    } catch (e) {
      logger.warn(`${TAG} Erro ao parsear corpo da requisição JSON. flowId=${reconnectFlowId ?? 'none'}:`, e);
      return errorResponse(
        IG_RECONNECT_ERROR_CODES.UNKNOWN,
        'Corpo da requisição inválido.',
        400,
        reconnectFlowId
      );
    }

    const { instagramAccountId } = requestBody;

    if (!instagramAccountId || typeof instagramAccountId !== 'string') {
      logger.warn(`${TAG} 'instagramAccountId' ausente ou inválido no corpo da requisição para User ID: ${userId}. Recebido: ${instagramAccountId}. flowId=${reconnectFlowId ?? 'none'}`);
      return errorResponse(
        IG_RECONNECT_ERROR_CODES.INVALID_IG_ACCOUNT_SELECTION,
        'ID da conta Instagram selecionada é obrigatório.',
        400,
        reconnectFlowId
      );
    }

    await connectToDatabase();
    const dbUser = await User.findById(userId)
      .select('instagramAccessToken availableIgAccounts instagramReconnectState instagramReconnectFlowId')
      .lean<{
        instagramAccessToken?: string | null;
        availableIgAccounts?: Array<{ igAccountId?: string | null }> | null;
        instagramReconnectState?: string | null;
        instagramReconnectFlowId?: string | null;
      } | null>();
    if (!dbUser) {
      return errorResponse(
        IG_RECONNECT_ERROR_CODES.UNKNOWN,
        'Usuário não encontrado para finalizar conexão do Instagram.',
        404,
        reconnectFlowId
      );
    }
    reconnectFlowId = normalizeInstagramReconnectFlowId(dbUser.instagramReconnectFlowId)
      ?? reconnectFlowId
      ?? generateInstagramReconnectFlowId();

    const availableAccountIds = new Set(
      (dbUser.availableIgAccounts ?? [])
        .map((acc) => acc?.igAccountId)
        .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    );
    if (!availableAccountIds.has(instagramAccountId)) {
      logger.warn(
        `${TAG} instagramAccountId inválido para User ${userId}. Selecionado=${instagramAccountId}, disponíveis=${availableAccountIds.size}. flowId=${reconnectFlowId}`
      );
      await User.findByIdAndUpdate(userId, {
        $set: {
          instagramReconnectState: 'failed',
          instagramReconnectFlowId: reconnectFlowId,
          instagramReconnectUpdatedAt: new Date(),
          instagramSyncErrorCode: IG_RECONNECT_ERROR_CODES.INVALID_IG_ACCOUNT_SELECTION,
        },
      });
      return errorResponse(
        IG_RECONNECT_ERROR_CODES.INVALID_IG_ACCOUNT_SELECTION,
        'A conta selecionada não pertence às contas autorizadas deste usuário.',
        400,
        reconnectFlowId
      );
    }

    const userInstagramLLAT = dbUser.instagramAccessToken ?? null;
    if (!userInstagramLLAT) {
      await User.findByIdAndUpdate(userId, {
        $set: {
          instagramReconnectState: 'failed',
          instagramReconnectFlowId: reconnectFlowId,
          instagramReconnectUpdatedAt: new Date(),
          instagramSyncErrorCode: IG_RECONNECT_ERROR_CODES.LINK_TOKEN_INVALID,
        },
      });
      return errorResponse(
        IG_RECONNECT_ERROR_CODES.LINK_TOKEN_INVALID,
        'Token de acesso ausente. Refaça a conexão com o Facebook.',
        400,
        reconnectFlowId
      );
    }

    logger.info(`${TAG} Tentando conectar User ID: ${userId} com Instagram Account ID: ${instagramAccountId}. flowId=${reconnectFlowId}`);

    // 3. Chamar o serviço para conectar a conta
    const userObjectId = new mongoose.Types.ObjectId(userId);
    await User.findByIdAndUpdate(userId, {
      $set: {
        instagramReconnectState: 'finalizing',
        instagramReconnectFlowId: reconnectFlowId,
        instagramReconnectUpdatedAt: new Date(),
      },
    });
    const result = await connectInstagramAccount(userObjectId, instagramAccountId, userInstagramLLAT);

    if (result.success) {
      logger.info(`${TAG} Conta Instagram ${instagramAccountId} conectada com sucesso para User ID: ${userId}. flowId=${reconnectFlowId}`);
      logger.info(`${TAG} telemetry ig_account_connected userId=${userId} flowId=${reconnectFlowId}`);
      return NextResponse.json(
        {
          success: true,
          message: 'Conta Instagram conectada com sucesso.',
          reconnectFlowId,
        },
        { status: 200 }
      );
    } else {
      logger.error(`${TAG} Falha ao conectar conta Instagram ${instagramAccountId} para User ID: ${userId}. Erro: ${result.error}. flowId=${reconnectFlowId}`);
      logger.info(`${TAG} telemetry ig_reconnect_failed userId=${userId} flowId=${reconnectFlowId}`);
      const errorCode =
        result.errorCode ||
        inferReconnectErrorCodeFromMessage(result.error) ||
        IG_RECONNECT_ERROR_CODES.UNKNOWN;
      await User.findByIdAndUpdate(userId, {
        $set: {
          instagramReconnectState: 'failed',
          instagramReconnectFlowId: reconnectFlowId,
          instagramReconnectUpdatedAt: new Date(),
          instagramSyncErrorCode: errorCode,
          instagramSyncErrorMsg: result.error ?? null,
        },
      });
      const statusCode =
        errorCode === IG_RECONNECT_ERROR_CODES.UNKNOWN ? 500 : 400;
      return errorResponse(
        errorCode,
        result.error || 'Falha ao conectar conta Instagram.',
        statusCode,
        reconnectFlowId
      );
    }

  } catch (error) {
    logger.error(`${TAG} Erro inesperado. flowId=${reconnectFlowId ?? 'none'}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor.';
    return errorResponse(
      IG_RECONNECT_ERROR_CODES.UNKNOWN,
      `Erro interno do servidor ao conectar conta Instagram. ${errorMessage}`,
      500,
      reconnectFlowId
    );
  }
}
