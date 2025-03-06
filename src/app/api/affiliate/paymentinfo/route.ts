import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import mongoose from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";

/**
 * GET /api/affiliate/paymentinfo?userId=...
 * Retorna os dados de pagamento (paymentInfo) do usuário logado.
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    // 1) Verifica token
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    // 2) Extrai userId da query
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "Parâmetro 'userId' é obrigatório." }, { status: 400 });
    }

    // 3) Compara com token.sub (usuário logado), se quiser restringir
    if (userId !== token.sub) {
      return NextResponse.json(
        { error: "Acesso negado: userId não corresponde ao usuário logado." },
        { status: 403 }
      );
    }

    // 4) Valida userId como ObjectId (opcional)
    if (!mongoose.isValidObjectId(userId)) {
      return NextResponse.json({ error: "ID de usuário inválido." }, { status: 400 });
    }

    // 5) Busca o usuário
    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    }

    // 6) Retorna os dados de pagamento
    return NextResponse.json(user.paymentInfo || {}, { status: 200 });
  } catch (err: any) {
    console.error("GET /api/affiliate/paymentinfo error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * PATCH /api/affiliate/paymentinfo
 * Body: { userId, pixKey, bankName, bankAgency, bankAccount }
 * Atualiza os dados de pagamento do usuário logado.
 */
export async function PATCH(request: NextRequest) {
  try {
    await connectToDatabase();

    // 1) Verifica token
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    // 2) Lê body
    const { userId, pixKey, bankName, bankAgency, bankAccount } = await request.json() || {};
    if (!userId) {
      return NextResponse.json({ error: "Parâmetro 'userId' é obrigatório." }, { status: 400 });
    }

    // 3) Compara com token.sub
    if (userId !== token.sub) {
      return NextResponse.json(
        { error: "Acesso negado: userId não corresponde ao usuário logado." },
        { status: 403 }
      );
    }

    // 4) Valida userId como ObjectId
    if (!mongoose.isValidObjectId(userId)) {
      return NextResponse.json({ error: "ID de usuário inválido." }, { status: 400 });
    }

    // 5) Busca o usuário
    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    }

    // 6) Atualiza paymentInfo
    user.paymentInfo.pixKey = (pixKey || "").trim();
    user.paymentInfo.bankName = (bankName || "").trim();
    user.paymentInfo.bankAgency = (bankAgency || "").trim();
    user.paymentInfo.bankAccount = (bankAccount || "").trim();

    await user.save();

    return NextResponse.json({
      message: "Dados de pagamento salvos com sucesso!",
      paymentInfo: user.paymentInfo,
    });
  } catch (err: any) {
    console.error("PATCH /api/affiliate/paymentinfo error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
