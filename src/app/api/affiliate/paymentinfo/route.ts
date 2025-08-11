// src/app/api/affiliate/paymentinfo/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import mongoose from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";

export const runtime = "nodejs";

/**
 * GET /api/affiliate/paymentinfo?userId=...
 * Retorna os dados de pagamento do usuário logado.
 */
export async function GET(request: NextRequest) {
  try {
    // 1) Conecta ao MongoDB
    await connectToDatabase();

    // 2) Obtém a sessão via getServerSession
    const session = await getServerSession(authOptions);
    console.debug("[paymentinfo:GET] Sessão retornada:", session);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    // 3) Extrai userId dos query params
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "Parâmetro 'userId' é obrigatório." }, { status: 400 });
    }

    // 4) Verifica se o userId da query é o mesmo da sessão (a menos que seja admin)
    if (userId !== session.user.id && session.user.role !== "admin") {
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
    // Seleciona apenas o campo paymentInfo para otimizar
    const user = await User.findById(userId).select('paymentInfo');

    if (!user) {
      // Se o usuário não for encontrado, retorna 404 (não necessariamente um erro se for a primeira vez)
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    }

    // 7) Retorna os dados de paymentInfo (pode ser um objeto vazio ou null/undefined se não preenchido)
    return NextResponse.json({
      paymentInfo: user.paymentInfo || {}, // Retorna objeto vazio se não houver dados
    });

  } catch (error: unknown) {
    console.error("[paymentinfo:GET] Erro:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/affiliate/paymentinfo
 * Body: { userId, pixKey, bankName, bankAgency, bankAccount }
 * Atualiza os dados de pagamento do usuário logado.
 * (Código existente mantido aqui para referência, mas está no mesmo arquivo)
 */
export async function PATCH(request: NextRequest) {
  try {
    // 1) Conecta ao MongoDB
    await connectToDatabase();

    // 2) Obtém a sessão via getServerSession
    const session = await getServerSession(authOptions);
    console.debug("[paymentinfo:PATCH] Sessão retornada:", session);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    // 3) Lê os dados do corpo da requisição
    const { userId, pixKey, bankName, bankAgency, bankAccount } = await request.json();
    if (!userId) {
      return NextResponse.json({ error: "Parâmetro 'userId' é obrigatório." }, { status: 400 });
    }

    // 4) Verifica se o userId do corpo é o mesmo da sessão (a menos que seja admin)
    if (userId !== session.user.id && session.user.role !== "admin") {
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
      ...(user.paymentInfo || {}),
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
