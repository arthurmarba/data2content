import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import mongoose from "mongoose";

import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";

/**
 * Gera um código de verificação aleatório com 6 caracteres maiúsculos.
 */
function generateVerificationCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export async function POST(request: NextRequest) {
  try {
    // 1) Verifica se há token (usuário logado) via JWT
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    // 2) Lê userId do body
    const body = await request.json() || {};
    const { userId } = body;
    if (!userId) {
      return NextResponse.json(
        { error: "Parâmetro 'userId' é obrigatório." },
        { status: 400 }
      );
    }

    // 3) Compara userId do body com o ID salvo no token (token.sub)
    if (userId !== token.sub) {
      return NextResponse.json(
        { error: "Acesso negado: userId não corresponde ao usuário logado." },
        { status: 403 }
      );
    }

    // 4) Conecta ao banco e valida ObjectId
    await connectToDatabase();
    if (!mongoose.isValidObjectId(userId)) {
      return NextResponse.json({ error: "ID de usuário inválido." }, { status: 400 });
    }

    // 5) Busca o usuário
    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    }

    // 6) Verifica se o plano está ativo
    if (user.planStatus !== "active") {
      return NextResponse.json(
        { error: "Você não possui um plano ativo." },
        { status: 403 }
      );
    }

    // 7) Gera o código de verificação e zera o telefone existente
    const verificationCode = generateVerificationCode();
    user.whatsappVerificationCode = verificationCode;
    user.whatsappPhone = null; // caso já existisse, limpamos para forçar re-verificação
    await user.save();

    // 8) Retorna o código gerado
    return NextResponse.json({ code: verificationCode }, { status: 200 });

  } catch (error: unknown) {
    console.error("Erro em POST /api/whatsapp/generateCode:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      { error: `Falha ao gerar código: ${errorMessage}` },
      { status: 500 }
    );
  }
}
