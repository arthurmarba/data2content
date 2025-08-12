import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import Redemption from "@/app/models/Redemption";
import stripe from "@/app/lib/stripe";
import { checkRateLimit } from "@/utils/rateLimit";
import { getClientIp } from "@/utils/getClientIp";

export const runtime = "nodejs";

function minForCurrency(cur: string) {
  const upper = cur.toUpperCase();
  const fromEnv = Number(process.env[`REDEEM_MIN_${upper}`] || 0);
  return fromEnv > 0 ? Math.round(fromEnv) : 50 * 100; // cents
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const ip = getClientIp(req);
    const { allowed } = await checkRateLimit(`redeem_connect:${session.user.id}:${ip}`, 2, 60);
    if (!allowed) return NextResponse.json({ error: "Muitas tentativas; tente novamente." }, { status: 429 });

    await connectToDatabase();
    const user = await User.findById(session.user.id);
    if (!user) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });

    const acctId = user.paymentInfo?.stripeAccountId || null;
    const status = user.paymentInfo?.stripeAccountStatus || null;
    if (!acctId || status !== "verified") {
      return NextResponse.json({ error: "Conecte e verifique sua conta Stripe antes do saque." }, { status: 400 });
    }

    // Obtemos a moeda destino direto da Stripe para garantir precisão
    const account = await stripe.accounts.retrieve(acctId);
    const destCurrency = ((account as any).default_currency || "").toLowerCase();
    if (!destCurrency) {
      return NextResponse.json({ error: "Moeda destino não disponível; finalize o onboarding da Stripe." }, { status: 400 });
    }

    // O resgate SEMPRE é na moeda destino
    const balances: Map<string, number> = user.affiliateBalances || new Map();
    const current = balances.get(destCurrency) ?? 0;
    const min = minForCurrency(destCurrency);
    if (current <= 0) return NextResponse.json({ error: "Sem saldo disponível." }, { status: 400 });
    if (current < min)
      return NextResponse.json({ error: `Valor mínimo: ${(min / 100).toFixed(2)} ${destCurrency.toUpperCase()}` }, { status: 400 });

    const existing = await Redemption.findOne({
      userId: user._id,
      currency: destCurrency,
      status: { $in: ['requested'] },
      requestedAt: { $gte: new Date(Date.now() - 30_000) },
    });
    if (existing) {
      return NextResponse.json({ error: "Já existe um saque em andamento." }, { status: 409 });
    }

    // Cria um registro de Redemption (estado 'requested') para ter trilha
    const redemption = await Redemption.create({
      userId: user._id,
      currency: destCurrency,
      amountCents: current,
      status: "requested",
      method: "connect",
      notes: "Redeem via Connect",
    });

    // Transfer Stripe → conta conectada do afiliado
    const idemKey = `redeem_${session.user.id}_${destCurrency}_${current}_${redemption._id}`;
    const transfer = await stripe.transfers.create(
      {
        amount: current,
        currency: destCurrency,
        destination: acctId,
        description: `Affiliate redeem ${destCurrency.toUpperCase()} ${current / 100}`,
        metadata: {
          redemptionId: String(redemption._id),
          affiliateUserId: String(user._id),
        },
      },
      { idempotencyKey: idemKey }
    );

    // Zera saldo daquela moeda e dá baixa no redemption
    balances.set(destCurrency, 0);
    user.markModified("affiliateBalances");
    await user.save();

    redemption.status = "paid"; // Transferência criada com sucesso (saldo na conta Connect)
    redemption.transferId = transfer.id;
    redemption.processedAt = new Date();
    await redemption.save();

    const plainBalances = Object.fromEntries(balances.entries());
    return NextResponse.json({
      success: true,
      transferId: transfer.id,
      currency: destCurrency,
      amountCents: current,
      newBalances: plainBalances,
    });
  } catch (err: any) {
    console.error("[affiliate/redeem] error:", err);
    const code = err?.raw?.code || err?.code;
    if (code === 'balance_insufficient') {
      return NextResponse.json({ error: "Saldo da plataforma insuficiente nesta moeda. Tente novamente em breve" }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro ao processar resgate." }, { status: 500 });
  }
}
