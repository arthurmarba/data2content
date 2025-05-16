// src/app/api/instagram/disconnect/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route'; // Ajuste o caminho se necessário
// ATUALIZADO para o novo módulo
import { clearInstagramConnection } from '@/app/lib/instagram'; 
import { logger } from '@/app/lib/logger';
import mongoose from 'mongoose'; // Para validar ObjectId

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // Garante execução dinâmica

/**
 * POST /api/instagram/disconnect
 * Desconecta a conta do Instagram para o usuário autenticado, limpando os dados no DB.
 */
export async function POST(request: NextRequest) {
    const TAG = '[POST /api/instagram/disconnect]';
    logger.info(`${TAG} Rota chamada.`);

    try {
        // 1. Autenticação e Obtenção do ID do Utilizador
        logger.debug(`${TAG} Verificando sessão...`);
        const session = await getServerSession(authOptions);

        if (!session?.user?.id || !mongoose.isValidObjectId(session.user.id)) {
            logger.warn(`${TAG} Tentativa de acesso não autenticada ou ID inválido. User ID: ${session?.user?.id}`);
            return NextResponse.json({ error: 'Não autenticado ou ID de usuário inválido' }, { status: 401 });
        }
        const userId = session.user.id;
        logger.info(`${TAG} Requisição autenticada para desconectar Instagram do User ${userId}.`);

        // 2. Chamar o Serviço para Limpar a Conexão
        // A função clearInstagramConnection já lida com a conexão ao DB internamente.
        // E espera um ObjectId ou string que seja um ObjectId válido.
        await clearInstagramConnection(userId);

        // 3. Retornar Sucesso
        // Mesmo que a função clearInstagramConnection encontre um erro interno (ex: usuário não encontrado),
        // do ponto de vista da API, a operação de "tentar desconectar" foi processada.
        // A função clearInstagramConnection já loga erros internos.
        logger.info(`${TAG} Conexão Instagram limpa (ou tentativa realizada) para User ${userId}.`);
        return NextResponse.json({ message: "Conta do Instagram desconectada com sucesso." }, { status: 200 });

    } catch (error: unknown) {
        // Captura erros inesperados na própria rota
        logger.error(`${TAG} Erro GERAL inesperado na rota:`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ error: "Erro interno do servidor ao desconectar", details: errorMessage }, { status: 500 });
    }
}
