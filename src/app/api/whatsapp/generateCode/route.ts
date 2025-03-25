import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import mongoose from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";

export const runtime = "nodejs";

/**
 * Gera um código de verificação aleatório com 6 caracteres maiúsculos.
 */
function generateVerificationCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

/**
 * POST /api/whatsapp/generateCode
 * Body: { userId }
 * Verifica se o userId corresponde ao usuário logado (sessão),
 * gera um código de verificação e zera o whatsappPhone para forçar re-verificação.
 */
export async function POST(request: NextRequest) {
  try {
    // 1) Obtém a sessão do usuário usando getServerSession com { req, ...authOptions }
    const session = await getServerSession({ req: request, ...authOptions });
    console.debug("[whatsapp/generateCode] Sessão retornada:", session);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    // 2) Lê userId do body da requisição
    const body = await request.json();
    const { userId } = body || {};
    if (!userId) {
      return NextResponse.json({ error: "Parâmetro 'userId' é obrigatório." }, { status: 400 });
    }

    // 3) Confirma que o userId do body corresponde ao ID da sessão
    if (userId !== session.user.id) {
      return NextResponse.json(
        { error: "Acesso negado: userId não corresponde ao usuário logado." },
        { status: 403 }
      );
    }

    // 4) Conecta ao banco e valida o userId como ObjectId
    await connectToDatabase();
    if (!mongoose.isValidObjectId(userId)) {
      return NextResponse.json({ error: "ID de usuário inválido." }, { status: 400 });
    }

    // 5) Busca o usuário no banco de dados
    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    }

    // 6) Verifica se o plano do usuário está ativo
    if (user.planStatus !== "active") {
      return NextResponse.json(
        { error: "Você não possui um plano ativo." },
        { status: 403 }
      );
    }

    // 7) Gera o código de verificação e zera o whatsappPhone para forçar re-verificação
    const verificationCode = generateVerificationCode();
    user.whatsappVerificationCode = verificationCode;
    user.whatsappPhone = null;
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
