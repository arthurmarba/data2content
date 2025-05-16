// src/app/api/instagram/connect-selected-account/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route'; 
import { connectInstagramAccount } from '@/app/lib/instagram'; 
import { logger } from '@/app/lib/logger';
import mongoose from 'mongoose';
import type { JWT } from "next-auth/jwt"; // Importar o tipo JWT estendido

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; 

interface RequestBody {
  instagramAccountId?: string;
}

export async function POST(request: NextRequest) {
  const TAG = '[API /instagram/connect-selected-account]';
  logger.info(`${TAG} Recebida requisição POST.`);

  try {
    // 1. Obter a sessão do usuário (que é o token JWT decodificado em API Routes)
    // Fazemos um cast para o nosso tipo JWT estendido para ter acesso aos campos personalizados.
    const session = await getServerSession(authOptions) as JWT | null;

    // Validação robusta da sessão e do ID do usuário (que vem do token.id)
    if (!session?.id || !mongoose.Types.ObjectId.isValid(session.id)) {
      logger.warn(`${TAG} Tentativa de conectar conta sem sessão válida ou ID de usuário inválido. Session ID (do token): ${session?.id}`);
      return NextResponse.json({ error: 'Não autorizado. Sessão ou ID de usuário inválido.' }, { status: 401 });
    }
    const userId = session.id; // O ID do usuário é o 'id' (ou 'sub') do token JWT

    // Acessar instagramAccessToken diretamente do objeto session (que é o token JWT)
    const userInstagramLLAT = session.instagramAccessToken;

    if (!userInstagramLLAT) {
        logger.error(`${TAG} Token de acesso de longa duração do Instagram (instagramAccessToken) não encontrado no token JWT para User ID: ${userId}.`);
        logger.debug(`${TAG} Conteúdo do token JWT para depuração:`, JSON.stringify(session, null, 2)); // Log para depuração
        return NextResponse.json({ error: 'Token de acesso do Instagram ausente. Por favor, refaça o processo de vinculação com o Facebook.' }, { status: 400 });
    }

    logger.debug(`${TAG} Sessão válida para User ID: ${userId}. LLAT do Instagram encontrado.`);

    // 2. Obter o instagramAccountId do corpo da requisição
    let requestBody: RequestBody;
    try {
      requestBody = await request.json();
    } catch (e) {
      logger.warn(`${TAG} Erro ao parsear corpo da requisição JSON:`, e);
      return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 });
    }

    const { instagramAccountId } = requestBody;

    if (!instagramAccountId || typeof instagramAccountId !== 'string') {
      logger.warn(`${TAG} 'instagramAccountId' ausente ou inválido no corpo da requisição para User ID: ${userId}. Recebido: ${instagramAccountId}`);
      return NextResponse.json({ error: 'ID da conta Instagram selecionada é obrigatório.' }, { status: 400 });
    }

    logger.info(`${TAG} Tentando conectar User ID: ${userId} com Instagram Account ID: ${instagramAccountId}`);

    // 3. Chamar o serviço para conectar a conta
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const result = await connectInstagramAccount(userObjectId, instagramAccountId, userInstagramLLAT);

    if (result.success) {
      logger.info(`${TAG} Conta Instagram ${instagramAccountId} conectada com sucesso para User ID: ${userId}.`);
      return NextResponse.json({ success: true, message: 'Conta Instagram conectada com sucesso.' }, { status: 200 });
    } else {
      logger.error(`${TAG} Falha ao conectar conta Instagram ${instagramAccountId} para User ID: ${userId}. Erro: ${result.error}`);
      return NextResponse.json({ error: result.error || 'Falha ao conectar conta Instagram.' }, { status: 500 });
    }

  } catch (error) {
    logger.error(`${TAG} Erro inesperado:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor.';
    return NextResponse.json({ error: 'Erro interno do servidor ao conectar conta Instagram.', details: errorMessage }, { status: 500 });
  }
}
