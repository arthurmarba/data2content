import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import stripe from "@/app/lib/stripe";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession({ req, ...authOptions });
    if (session?.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    await connectToDatabase();
    const commissionId = params.id;
    const affUser = await User.findOne({ "commissionLog.sourcePaymentId": commissionId });
    if (!affUser) {
      return NextResponse.json({ error: 'Comissão não encontrada' }, { status: 404 });
    }
    const entry = affUser.commissionLog?.find(e => e.sourcePaymentId === commissionId);
    if (!entry || !['failed', 'fallback'].includes(entry.status)) {
      return NextResponse.json({ error: 'Comissão não elegível para reprocessamento' }, { status: 400 });
    }
    if (!affUser.paymentInfo?.stripeAccountId || affUser.paymentInfo.stripeAccountStatus !== 'verified') {
      return NextResponse.json({ error: 'Conta do afiliado não verificada' }, { status: 400 });
    }

    const amountCents = entry.amountCents ?? Math.round(entry.amount * 100);
    const currency = entry.currency || 'usd';
    const transfer = await stripe.transfers.create({
      amount: amountCents,
      currency,
      destination: affUser.paymentInfo.stripeAccountId,
      description: entry.description,
      metadata: {
        invoiceId: entry.sourcePaymentId || '',
        referredUserId: entry.referredUserId ? String(entry.referredUserId) : '',
        affiliateUserId: String(affUser._id),
        affiliateCode: affUser.affiliateCode || ''
      }
    }, { idempotencyKey: `commission_${entry.sourcePaymentId}_${affUser._id}` });

    entry.status = 'paid';
    entry.transferId = transfer.id;
    affUser.affiliateBalance = Math.max((affUser.affiliateBalance || 0) - amountCents / 100, 0);
    affUser.affiliateBalanceCents = Math.max((affUser.affiliateBalanceCents || 0) - amountCents, 0);
    await affUser.save();

    return NextResponse.json({ success: true, transferId: transfer.id });
  } catch (err) {
    console.error('[admin/affiliate/commissions/retry] error:', err);
    return NextResponse.json({ error: 'Erro ao reprocessar comissão' }, { status: 500 });
  }
}
