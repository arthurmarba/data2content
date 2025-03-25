import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import mongoose from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";

export const runtime = "nodejs";

/**
 * PATCH /api/affiliate/paymentinfo
 * Body: { userId, pixKey, bankName, bankAgency, bankAccount }
 * Atualiza os dados de pagamento do usuário logado.
 */
export async function PATCH(request: NextRequest) {
  try {
    // 1) Conecta ao MongoDB
    await connectToDatabase();

    // 2) Obtém a sessão via getServerSession
    const session = await getServerSession({ req: request, ...authOptions });
    console.debug("[paymentinfo:PATCH] Sessão retornada:", session);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    // 3) Lê os dados do corpo da requisição
    const { userId, pixKey, bankName, bankAgency, bankAccount } = await request.json();
    if (!userId) {
      return NextResponse.json({ error: "Parâmetro 'userId' é obrigatório." }, { status: 400 });
    }

    // 4) Verifica se o userId do corpo é o mesmo da sessão
    if (userId !== session.user.id) {
      return NextResponse.json(
        { error: "Acesso negado: userId não corresponde ao usuário logado." },
        { status: 403 }
      );
    }

    // 5) Valida se userId é um ObjectId válido
    if (!mongoose.isValidObjectId(userId)) {
      return NextResponse.json({ error: "ID de usuário inválido." }, { status: 400 });
    }

    // 6) Busca o usuário no banco de dados
    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    }

    // 7) Atualiza os dados de paymentInfo
    user.paymentInfo = {
      pixKey: (pixKey || "").trim(),
      bankName: (bankName || "").trim(),
      bankAgency: (bankAgency || "").trim(),
      bankAccount: (bankAccount || "").trim(),
    };

    await user.save();

    return NextResponse.json({
      message: "Dados de pagamento salvos com sucesso!",
      paymentInfo: user.paymentInfo,
    });
  } catch (error: unknown) {
    console.error("[paymentinfo:PATCH] Erro:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
