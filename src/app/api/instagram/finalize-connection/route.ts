// src/app/api/instagram/finalize-connection/route.ts
// Rota para finalizar a conexão com o Instagram após o usuário selecionar a conta.

import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route"; // Importa suas authOptions
import { logger } from '@/app/lib/logger';
import { getTemporaryLlat } from '@/app/lib/tempTokenStorage'; // Importa função para pegar LLAT temporário
import { finalizeInstagramConnection } from '@/app/lib/instagramService'; // Importa função para finalizar conexão
import mongoose from 'mongoose';

const TAG = '[API /instagram/finalize-connection]';

export async function POST(request: Request) {
    logger.info(`${TAG} Recebida requisição POST.`);

    // 1. Obter a sessão do usuário
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !mongoose.isValidObjectId(session.user.id)) {
        logger.warn(`${TAG} Tentativa de acesso não autenticada ou ID de usuário inválido.`);
        return NextResponse.json({ message: 'Não autorizado.' }, { status: 401 });
    }
    const userId = session.user.id;
    logger.debug(`${TAG} Sessão válida encontrada para User ID: ${userId}`);

    // 2. Obter o ID da conta selecionada do corpo da requisição
    let selectedIgAccountId: string | undefined;
    try {
        const body = await request.json();
        selectedIgAccountId = body?.selectedIgAccountId;
        if (!selectedIgAccountId || typeof selectedIgAccountId !== 'string') {
            logger.warn(`${TAG} 'selectedIgAccountId' ausente ou inválido no corpo da requisição para User ${userId}. Body:`, body);
            return NextResponse.json({ message: 'ID da conta Instagram selecionada é obrigatório.' }, { status: 400 });
        }
        logger.debug(`${TAG} Conta IG selecionada pelo usuário ${userId}: ${selectedIgAccountId}`);
    } catch (error) {
        logger.error(`${TAG} Erro ao parsear corpo da requisição para User ${userId}:`, error);
        return NextResponse.json({ message: 'Requisição inválida.' }, { status: 400 });
    }

    // 3. Recuperar o LLAT armazenado temporariamente
    let longLivedAccessToken: string | null = null;
    try {
        longLivedAccessToken = await getTemporaryLlat(userId);
        if (!longLivedAccessToken) {
            logger.error(`${TAG} LLAT temporário não encontrado ou expirado para User ${userId}. O usuário pode ter demorado muito para selecionar.`);
            return NextResponse.json({ message: 'Sua sessão de conexão expirou. Por favor, tente conectar novamente.' }, { status: 400 }); // 400 Bad Request ou talvez 408 Request Timeout
        }
        logger.info(`${TAG} LLAT temporário recuperado com sucesso para User ${userId}.`);
    } catch (error) {
        logger.error(`${TAG} Erro ao recuperar LLAT temporário para User ${userId}:`, error);
        return NextResponse.json({ message: 'Erro interno ao recuperar dados da conexão.' }, { status: 500 });
    }

    // 4. Chamar a função para finalizar a conexão no banco de dados
    try {
        const finalizationResult = await finalizeInstagramConnection(
            userId,
            selectedIgAccountId,
            longLivedAccessToken
        );

        if (finalizationResult.success) {
            logger.info(`${TAG} Conexão Instagram finalizada com sucesso para User ${userId} e Conta IG ${selectedIgAccountId}.`);
            // Opcional: Atualizar a sessão imediatamente se necessário, embora o próximo request deva pegá-la atualizada.
            // await update({ trigger: "update" }); // Pode precisar importar `update` de next-auth/react se estiver no frontend, ou revalidar a sessão no backend se possível.
            return NextResponse.json({ success: true, message: 'Conta Instagram conectada com sucesso!' });
        } else {
            logger.error(`${TAG} Falha ao finalizar a conexão no DB para User ${userId}: ${finalizationResult.error}`);
            return NextResponse.json({ message: finalizationResult.error || 'Erro ao salvar a conexão.' }, { status: 500 });
        }
    } catch (error) {
        logger.error(`${TAG} Erro crítico ao chamar finalizeInstagramConnection para User ${userId}:`, error);
        return NextResponse.json({ message: 'Erro interno inesperado ao finalizar a conexão.' }, { status: 500 });
    }
}

// Opcional: Adicionar handler para outros métodos (GET, PUT, DELETE) se necessário,
// retornando erro 405 Method Not Allowed.
export async function GET() {
    return NextResponse.json({ message: 'Método não permitido' }, { status: 405 });
}
// ... outros métodos ...

