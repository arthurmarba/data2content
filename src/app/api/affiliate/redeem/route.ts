import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import Redemption from "@/app/models/Redemption";
import { Model, Document } from "mongoose";

export const runtime = "nodejs";

/**
 * Interface para o documento de Redemption.
 */
interface IRedemption extends Document {
  user: string; // ou Types.ObjectId se preferir
  amount: number;
  status: "pending" | "paid" | "canceled";
  paymentMethod: string;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * GET /api/affiliate/redeem?userId=...
 * Lista os saques do usuário logado.
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    // Obtém a sessão do usuário
    const session = await getServerSession({ req: request, ...authOptions });
    console.debug("[redeem:GET] Sessão:", session);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    // Extrai userId dos query params
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "Faltou userId" }, { status: 400 });
    }

    // Verifica se o userId da query corresponde ao da sessão
    if (userId !== session.user.id) {
      return NextResponse.json(
        { error: "Acesso negado: userId não corresponde ao usuário logado." },
        { status: 403 }
      );
    }

    // Busca os resgates do usuário
    const redemptionModel = Redemption as unknown as Model<IRedemption>;
    const redemptions = await redemptionModel.find({ user: userId }).sort({ createdAt: -1 });

    return NextResponse.json(redemptions, { status: 200 });
  } catch (error: unknown) {
    console.error("[redeem:GET] Erro:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/affiliate/redeem
 * Cria solicitação de saque para o usuário logado.
 * Body: { userId }
 */
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();

    // Obtém a sessão do usuário
    const session = await getServerSession({ req: request, ...authOptions });
    console.debug("[redeem:POST] Sessão:", session);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const { userId } = body || {};
    if (!userId) {
      return NextResponse.json({ error: "Parâmetro userId é obrigatório." }, { status: 400 });
    }

    // Garante que o userId do corpo corresponda ao da sessão
    if (userId !== session.user.id) {
      return NextResponse.json(
        { error: "Acesso negado: userId não corresponde ao usuário logado." },
        { status: 403 }
      );
    }

    // Busca o usuário
    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    }

    // Verifica se os dados bancários foram preenchidos
    const { pixKey, bankName, bankAgency, bankAccount } = user.paymentInfo || {};
    const hasPaymentInfo = !!(pixKey || bankName || bankAgency || bankAccount);
    if (!hasPaymentInfo) {
      return NextResponse.json(
        { error: "É preciso preencher os dados bancários antes de solicitar o saque." },
        { status: 400 }
      );
    }

    // Verifica saldo
    const balance = user.affiliateBalance || 0;
    if (balance <= 0) {
      return NextResponse.json(
        { error: "Saldo insuficiente para resgatar." },
        { status: 400 }
      );
    }

    // Cria registro do saque
    const redemptionModel = Redemption as unknown as Model<IRedemption>;
    const newRedemption = await redemptionModel.create({
      user: user._id,
      amount: balance,
      status: "pending",
      paymentMethod: "",
      notes: "",
    });

    // Zera o saldo do usuário
    user.affiliateBalance = 0;
    await user.save();

    return NextResponse.json({
      message: "Solicitação de resgate criada com sucesso!",
      redemption: newRedemption,
    });
  } catch (error: unknown) {
    console.error("[redeem:POST] Erro:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/affiliate/redeem
 * Atualiza o status do saque (apenas admin).
 * Body: { redeemId, newStatus }
 */
export async function PATCH(request: NextRequest) {
  try {
    await connectToDatabase();

    // Obtém a sessão do usuário
    const session = await getServerSession({ req: request, ...authOptions });
    console.debug("[redeem:PATCH] Sessão:", session);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const { redeemId, newStatus } = body || {};
    if (!redeemId || !newStatus) {
      return NextResponse.json(
        { error: "Parâmetros redeemId e newStatus são obrigatórios." },
        { status: 400 }
      );
    }

    const redemptionModel = Redemption as unknown as Model<IRedemption>;
    const redemption = await redemptionModel.findById(redeemId);
    if (!redemption) {
      return NextResponse.json({ error: "Resgate não encontrado." }, { status: 404 });
    }

    redemption.status = newStatus;
    await redemption.save();

    return NextResponse.json({
      message: `Status atualizado para "${newStatus}" com sucesso!`,
      redemption,
    });
  } catch (error: unknown) {
    console.error("[redeem:PATCH] Erro:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
