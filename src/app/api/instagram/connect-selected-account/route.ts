// src/app/api/instagram/connect-selected-account/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route'; // Ajuste o caminho conforme sua estrutura
import { connectInstagramAccount } from '@/app/lib/instagram'; // ATUALIZADO para o novo módulo
import { logger } from '@/app/lib/logger';
import mongoose from 'mongoose';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // Garante que a route seja sempre dinâmica

interface RequestBody {
  instagramAccountId?: string;
}

export async function POST(request: NextRequest) {
  const TAG = '[API /instagram/connect-selected-account]';
  logger.info(`${TAG} Recebida requisição POST.`);

  try {
    // 1. Obter a sessão do usuário
    const session = await getServerSession(authOptions);

    // Validação robusta da sessão e do ID do usuário
    if (!session?.user?.id || typeof session.user.id !== 'string' || !mongoose.Types.ObjectId.isValid(session.user.id)) {
      logger.warn(`${TAG} Tentativa de conectar conta sem sessão válida ou ID de usuário inválido. User ID: ${session?.user?.id}`);
      return NextResponse.json({ error: 'Não autorizado. Sessão ou ID de usuário inválido.' }, { status: 401 });
    }
    const userId = session.user.id;

    // O token de acesso de longa duração do Instagram do usuário deve estar na sessão (ou token JWT).
    // No seu [...nextauth]/route.ts, o campo 'instagramAccessToken' do token JWT é populado.
    // A interface da sessão NextAuth pode precisar ser estendida para incluir 'instagramAccessToken' diretamente,
    // ou acessamos via casting se soubermos que está no token.
    // Assumindo que o token JWT (e, por extensão, a sessão via callback) contém 'instagramAccessToken'.
    const userInstagramLLAT = (session as any)?.token?.instagramAccessToken as string | undefined || (session.user as any)?.instagramAccessToken as string | undefined;


    if (!userInstagramLLAT) {
        logger.error(`${TAG} Token de acesso de longa duração do Instagram do usuário não encontrado na sessão/token para User ID: ${userId}.`);
        // Log para depuração - NÃO FAÇA ISSO EM PRODUÇÃO COM DADOS SENSÍVEIS
        // logger.debug(`${TAG} Conteúdo completo da sessão para depuração:`, JSON.stringify(session, null, 2));
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
    // A função connectInstagramAccount espera um ObjectId para userId.
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
