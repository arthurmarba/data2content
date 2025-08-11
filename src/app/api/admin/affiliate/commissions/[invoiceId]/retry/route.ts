import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import stripe from "@/app/lib/stripe";
import { checkRateLimit } from "@/utils/rateLimit";
import { logger } from "@/app/lib/logger";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: { invoiceId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const ip = req.headers.get('x-forwarded-for') || req.ip || 'unknown';
    const { allowed } = await checkRateLimit(`admin_retry:${session.user.id ?? 'anon'}:${ip}`, 5, 60);
    if (!allowed) {
      return NextResponse.json({ error: 'Muitas tentativas, tente novamente mais tarde.' }, { status: 429 });
    }

    logger.info('[admin/affiliate/commissions/retry] attempt', {
      adminUserId: session.user.id,
      ip,
      invoiceId: params.invoiceId,
    });

    await connectToDatabase();
    const invoiceId = params.invoiceId;
    const affUser = await User.findOne({ "commissionLog.sourcePaymentId": invoiceId });
    if (!affUser) {
      return NextResponse.json({ error: 'Comissão não encontrada' }, { status: 404 });
    }
    const entry = affUser.commissionLog?.find(e => e.sourcePaymentId === invoiceId);
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
    affUser.affiliateBalanceCents = Math.max((affUser.affiliateBalanceCents || 0) - amountCents, 0);
    affUser.markModified('commissionLog');
    await affUser.save();

    return NextResponse.json({ success: true, transferId: transfer.id });
  } catch (err) {
    logger.error('[admin/affiliate/commissions/retry] error', err);
    return NextResponse.json({ error: 'Erro ao reprocessar comissão' }, { status: 500 });
  }
}
