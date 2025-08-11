import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import Redemption from "@/app/models/Redemption";
import { checkRateLimit } from "@/utils/rateLimit";
import { getClientIp } from "@/utils/getClientIp";
import { normCur } from "@/utils/normCur";

export const runtime = "nodejs";

function minForCurrency(cur: string) {
  const upper = cur.toUpperCase();
  const envKey = `REDEEM_MIN_${upper}`;
  const fromEnv = Number(process.env[envKey] || 0);
  if (fromEnv > 0) return Math.round(fromEnv); // já em cents
  return 50 * 100; // default 50.00
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const ip = getClientIp(req);
  const { allowed } = await checkRateLimit(`redeem:${session.user.id}:${ip}`, 1, 30);
  if (!allowed) return NextResponse.json({ error: "Muitas tentativas, tente novamente mais tarde." }, { status: 429 });

  const { currency } = await req.json().catch(() => ({}));
  if (!currency) return NextResponse.json({ error: "currency é obrigatório" }, { status: 400 });
  const cur = normCur(currency);

  await connectToDatabase();
  const user = await User.findById(session.user.id);
  if (!user) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });

  const balances = user.affiliateBalances || new Map<string, number>();
  const current = balances.get(cur) ?? 0;
  const min = minForCurrency(cur);
  if (current <= 0) return NextResponse.json({ error: "Sem saldo para resgate nesta moeda" }, { status: 400 });
  if (current < min) return NextResponse.json({ error: `Valor mínimo para resgate em ${cur.toUpperCase()}: ${(min/100).toFixed(2)}` }, { status: 400 });

  const payoutMode = user.affiliatePayoutMode || 'manual';
  let method: 'manual' | 'connect' = 'manual';
  if (payoutMode === 'connect' && user.paymentInfo?.stripeAccountStatus === 'verified') {
    method = 'connect';
  } else {
    const hasPix = !!user.paymentInfo?.pixKey;
    const hasBank = !!(user.paymentInfo?.bankName && user.paymentInfo?.bankAgency && user.paymentInfo?.bankAccount);
    if (!hasPix && !hasBank) {
      return NextResponse.json({ error: "Defina seus dados de pagamento (Pix ou bancários) antes de solicitar." }, { status: 400 });
    }
  }

  const redemption = await Redemption.create({
    userId: user._id,
    currency: cur,
    amountCents: current,
    status: 'requested',
    method
  });

  balances.set(cur, 0);
  user.markModified('affiliateBalances');
  await user.save();

  const plainBalances = Object.fromEntries(balances.entries());
  return NextResponse.json({
    redemptionId: String(redemption._id),
    currency: cur,
    amountCents: current,
    newBalances: plainBalances
  });
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  await connectToDatabase();
  const redemptions = await Redemption.find({ userId: session.user.id }).sort({ requestedAt: -1 });
  return NextResponse.json(redemptions);
}
