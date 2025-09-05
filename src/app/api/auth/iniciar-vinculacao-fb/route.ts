import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route'; // Ajuste o caminho se necessário
import { connectToDatabase } from '@/app/lib/mongoose';
import UserModel, { IUser } from '@/app/models/User'; // Importa o modelo e a interface
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { logger } from '@/app/lib/logger'; // Importa o logger

// Define o tempo de expiração do token em minutos
// Aumentado para maior resiliência em fluxos de OAuth (retries, atrasos)
const LINK_TOKEN_EXPIRY_MINUTES = 60;

export async function POST(request: Request) {
  const TAG = '[API /iniciar-vinculacao-fb]';
  logger.info(`${TAG} Recebida requisição POST.`);

  try {
    // 1. Obter a sessão do usuário
    //    Usamos getServerSession com as authOptions para obter a sessão no lado do servidor
    const session = await getServerSession(authOptions);

    // Verifica se o usuário está logado e se temos o ID dele (que deve ser um ObjectId)
    if (!session?.user?.id || typeof session.user.id !== 'string') {
      logger.warn(`${TAG} Tentativa de iniciar vinculação sem sessão válida.`);
      return NextResponse.json({ message: 'Não autorizado. Faça login primeiro.' }, { status: 401 });
    }

    const userId = session.user.id;
    logger.debug(`${TAG} Sessão válida encontrada para User ID: ${userId}`);

    // 2. Gerar token seguro e data de expiração
    const linkToken = crypto.randomBytes(32).toString('hex'); // Gera um token aleatório de 64 caracteres hex
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + LINK_TOKEN_EXPIRY_MINUTES); // Define a expiração

    logger.debug(`${TAG} Token de link gerado para User ${userId}. Expira em: ${expiresAt.toISOString()}`);

    // 3. Conectar ao banco de dados
    await connectToDatabase();

    // 4. Atualizar o documento do usuário no DB com o token e a expiração
    const updatedUser = await UserModel.findByIdAndUpdate(
      userId,
      {
        $set: {
          linkToken: linkToken,
          linkTokenExpiresAt: expiresAt,
        },
      },
      { new: true } // Retorna o documento atualizado (opcional aqui)
    );

    if (!updatedUser) {
      logger.error(`${TAG} Usuário ${userId} não encontrado no DB para salvar o linkToken.`);
      return NextResponse.json({ message: 'Erro ao encontrar usuário.' }, { status: 404 });
    }

    logger.info(`${TAG} linkToken salvo com sucesso no DB para User ${userId}.`);

    // 5. Definir o cookie temporário 'auth-link-token'
    const cookieStore = cookies();
    cookieStore.set('auth-link-token', linkToken, {
      httpOnly: true, // Impede acesso via JavaScript no cliente
      secure: process.env.NODE_ENV === 'production', // Usar secure apenas em produção (HTTPS)
      sameSite: 'lax', // Proteção CSRF razoável
      maxAge: LINK_TOKEN_EXPIRY_MINUTES * 60, // Tempo de vida do cookie em segundos
      path: '/', // Cookie disponível em todo o site
    });

    logger.info(`${TAG} Cookie 'auth-link-token' definido com sucesso.`);

    // 6. Retornar sucesso
    return NextResponse.json({ message: 'Iniciação de vinculação bem-sucedida.' }, { status: 200 });

  } catch (error) {
    logger.error(`${TAG} Erro inesperado:`, error);
    // Retorna um erro genérico em caso de falha
    return NextResponse.json({ message: 'Erro interno do servidor ao iniciar vinculação.' }, { status: 500 });
  }
}
