// src/app/api/affiliate/paymentinfo/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import mongoose from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";

// Garante que essa rota use Node.js em vez de Edge (caso esteja no App Router).
export const runtime = "nodejs";

/**
 * GET /api/affiliate/paymentinfo?userId=...
 * Retorna os dados de pagamento (paymentInfo) do usuário logado.
 */
export async function GET(request: NextRequest) {
  try {
    // 1) Conecta ao MongoDB
    await connectToDatabase();

    // 2) Obtém o token via cookies (JWT)
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      // Se chegar aqui, provavelmente não há cookies ou o token expirou
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    // 3) Extrai userId da query
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "Parâmetro 'userId' é obrigatório." }, { status: 400 });
    }

    // 4) Verifica se token.sub é string
    if (typeof token.sub !== "string") {
      // Se token.sub for undefined ou não-string, a rota não reconhece o usuário
      return NextResponse.json({ error: "Token inválido ou ausente (sub não é string)." }, { status: 401 });
    }

    // 5) Compara userId com token.sub
    if (userId !== token.sub) {
      return NextResponse.json(
        { error: "Acesso negado: userId não corresponde ao usuário logado." },
        { status: 403 }
      );
    }

    // 6) Valida userId como ObjectId
    if (!mongoose.isValidObjectId(userId)) {
      return NextResponse.json({ error: "ID de usuário inválido." }, { status: 400 });
    }

    // 7) Busca o usuário no DB
    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    }

    // 8) Retorna os dados de pagamento
    // Se user.paymentInfo estiver indefinido, retornamos objeto vazio
    return NextResponse.json(user.paymentInfo || {}, { status: 200 });

  } catch (error: unknown) {
    console.error("GET /api/affiliate/paymentinfo error:", error);
    let message = "Erro desconhecido.";
    if (error instanceof Error) {
      message = error.message;
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/affiliate/paymentinfo
 * Body: { userId, pixKey, bankName, bankAgency, bankAccount }
 * Atualiza os dados de pagamento do usuário logado.
 */
export async function PATCH(request: NextRequest) {
  try {
    // 1) Conecta ao MongoDB
    await connectToDatabase();

    // 2) Obtém o token
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    // 3) Lê body
    const { userId, pixKey, bankName, bankAgency, bankAccount } = await request.json() || {};
    if (!userId) {
      return NextResponse.json({ error: "Parâmetro 'userId' é obrigatório." }, { status: 400 });
    }

    // 4) Verifica se token.sub é string
    if (typeof token.sub !== "string") {
      return NextResponse.json({ error: "Token inválido ou ausente (sub não é string)." }, { status: 401 });
    }

    // 5) Compara userId com token.sub
    if (userId !== token.sub) {
      return NextResponse.json(
        { error: "Acesso negado: userId não corresponde ao usuário logado." },
        { status: 403 }
      );
    }

    // 6) Valida userId como ObjectId
    if (!mongoose.isValidObjectId(userId)) {
      return NextResponse.json({ error: "ID de usuário inválido." }, { status: 400 });
    }

    // 7) Busca o usuário
    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    }

    // 8) Atualiza paymentInfo
    if (!user.paymentInfo) {
      user.paymentInfo = {};
    }
    user.paymentInfo.pixKey = (pixKey || "").trim();
    user.paymentInfo.bankName = (bankName || "").trim();
    user.paymentInfo.bankAgency = (bankAgency || "").trim();
    user.paymentInfo.bankAccount = (bankAccount || "").trim();

    await user.save();

    return NextResponse.json({
      message: "Dados de pagamento salvos com sucesso!",
      paymentInfo: user.paymentInfo,
    });

  } catch (error: unknown) {
    console.error("PATCH /api/affiliate/paymentinfo error:", error);
    let message = "Erro desconhecido.";
    if (error instanceof Error) {
      message = error.message;
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
