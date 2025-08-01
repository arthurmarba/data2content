// src/app/api/user/complete-onboarding/route.ts
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route"; // Ajuste o caminho se for diferente
import { connectToDatabase } from "@/app/lib/mongoose"; // Ajuste o caminho se for diferente
import DbUser from "@/app/models/User"; // Ajuste o caminho se for diferente
import { logger } from "@/app/lib/logger"; // Ajuste o caminho se for diferente
import { NextResponse } from "next/server";
import { Types } from "mongoose";

export async function POST(req: Request) {
  const TAG = "[API complete-onboarding]";
  let session;

  try {
    session = await getServerSession(authOptions);
  } catch (error) {
    logger.error(`${TAG} Erro ao obter sessão:`, error);
    return NextResponse.json({ message: "Erro de autenticação ao obter sessão." }, { status: 500 });
  }

  if (!session || !session.user || !session.user.id) {
    logger.warn(`${TAG} Tentativa de acesso não autenticada.`);
    return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
  }

  const userId = session.user.id;

  if (!Types.ObjectId.isValid(userId)) {
    logger.error(`${TAG} User ID inválido na sessão: ${userId}`);
    return NextResponse.json({ message: "ID de usuário inválido." }, { status: 400 });
  }

  try {
    await connectToDatabase();
    logger.info(`${TAG} Conectado ao banco de dados para o usuário: ${userId}.`);

    const updatedUser = await DbUser.findByIdAndUpdate(
      userId,
      {
        $set: {
          isNewUserForOnboarding: false, // Marca que o onboarding foi concluído
          onboardingCompletedAt: new Date(), // Opcional, mas bom para rastreamento
          // Se você atualizou a versão dos termos aceitos aqui, poderia setar também:
          // communityInspirationTermsVersion: "SUA_VERSAO_ATUAL_DOS_TERMOS_GERAIS",
        },
      },
      { new: true } // Retorna o documento atualizado
    );

    if (!updatedUser) {
      logger.error(`${TAG} Usuário não encontrado no banco de dados para atualização: ${userId}`);
      return NextResponse.json({ message: "Usuário não encontrado." }, { status: 404 });
    }

    logger.info(`${TAG} Onboarding completado e usuário atualizado com sucesso para: ${userId}. isNewUserForOnboarding agora é ${updatedUser.isNewUserForOnboarding}.`);
    return NextResponse.json({ message: "Onboarding completado com sucesso." }, { status: 200 });

  } catch (error) {
    logger.error(`${TAG} Erro de servidor ao tentar completar onboarding para ${userId}:`, error);
    return NextResponse.json({ message: "Erro interno do servidor." }, { status: 500 });
  }
}