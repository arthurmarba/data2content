import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import { Redemption } from "@/app/models/Redemption";
import { Model } from "mongoose";

// GET: lista os saques do usuário
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    // Verifica token (usuário logado)
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    // Extrai userId da query
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "Faltou userId" }, { status: 400 });
    }

    // Garante que o userId seja do próprio usuário (se quiser essa segurança)
    if (userId !== token.sub) {
      return NextResponse.json(
        { error: "Acesso negado: userId não corresponde ao usuário logado." },
        { status: 403 }
      );
    }

    // Faz o cast para Model<any> para garantir os métodos de consulta
    const redemptionModel = Redemption as Model<any>;
    const redemptions = await redemptionModel.find({ user: userId }).sort({ createdAt: -1 });
    return NextResponse.json(redemptions, { status: 200 });
  } catch (error: unknown) {
    console.error("GET /api/affiliate/redeem error:", error);

    let message = "Erro desconhecido.";
    if (error instanceof Error) {
      message = error.message;
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST: cria solicitação de saque
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();

    // Verifica token
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { userId } = await request.json() || {};
    if (!userId) {
      return NextResponse.json({ error: "Parâmetro userId é obrigatório." }, { status: 400 });
    }

    // Garante que o userId seja do próprio usuário
    if (userId !== token.sub) {
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

    // Verifica se tem dados bancários preenchidos
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

    // Cria registro do saque (fazendo cast para garantir os métodos de criação)
    const redemptionModel = Redemption as Model<any>;
    const newRedemption = await redemptionModel.create({
      user: user._id,
      amount: balance,
      status: "pending",
    });

    // Zera o saldo do usuário
    user.affiliateBalance = 0;
    await user.save();

    return NextResponse.json({
      message: "Solicitação de resgate criada com sucesso!",
      redemption: newRedemption,
    });
  } catch (error: unknown) {
    console.error("POST /api/affiliate/redeem error:", error);

    let message = "Erro desconhecido.";
    if (error instanceof Error) {
      message = error.message;
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH: atualiza status do saque (admin)
export async function PATCH(request: NextRequest) {
  try {
    await connectToDatabase();

    // Verifica token
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    // Se quiser apenas admin, verifique token.role etc.
    // if (token.role !== "admin") {
    //   return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    // }

    const { redeemId, newStatus } = await request.json() || {};
    if (!redeemId || !newStatus) {
      return NextResponse.json(
        { error: "Parâmetros redeemId e newStatus são obrigatórios." },
        { status: 400 }
      );
    }

    const redemptionModel = Redemption as Model<any>;
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
    console.error("PATCH /api/affiliate/redeem error:", error);

    let message = "Erro desconhecido.";
    if (error instanceof Error) {
      message = error.message;
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
