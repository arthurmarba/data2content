// ./src/app/api/admin/affiliate/commissions/[invoiceId]/retry/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import { stripe } from "@/app/lib/stripe";
import { checkRateLimit } from "@/utils/rateLimit";
import { logger } from "@/app/lib/logger";
import { getClientIp } from "@/utils/getClientIp";
import { normCur } from "@/utils/normCur";
export const dynamic = 'force-dynamic';


export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: { invoiceId: string } }) {
  try {
    const session = (await getServerSession(authOptions)) as any;
    if (session?.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const ip = getClientIp(req);
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

    const affUser = await User.findOne({ "commissionLog.invoiceId": invoiceId });
    if (!affUser) {
      return NextResponse.json({ error: 'Comissão não encontrada' }, { status: 404 });
    }

    const entry = affUser.commissionLog?.find((e: any) => e.invoiceId === invoiceId);
    // Elegível apenas se ainda está 'available' (não paga/cancelada/reversed/pending)
    if (!entry || entry.status !== 'available') {
      return NextResponse.json({ error: 'Comissão não elegível para reprocessamento' }, { status: 400 });
    }

    if (!affUser.paymentInfo?.stripeAccountId || affUser.paymentInfo.stripeAccountStatus !== 'verified') {
      return NextResponse.json({ error: 'Conta do afiliado não verificada' }, { status: 400 });
    }

    const amountCents = entry.amountCents;
    const currency = normCur(entry.currency);
    const account = await stripe.accounts.retrieve(affUser.paymentInfo.stripeAccountId!);
    const destCurrency = normCur((account as any)?.default_currency || '');

    // ⚠️ Não mude o status para 'fallback' (valor inválido no tipo). Apenas retorne esse "estado" para a UI.
    if (!destCurrency || destCurrency !== currency) {
      logger.info('[admin/affiliate/commissions/retry] fallback_currency_mismatch', {
        invoiceId: entry.invoiceId,
        currency,
        destCurrency,
        accountId: affUser.paymentInfo.stripeAccountId,
      });
      return NextResponse.json({ success: true, status: 'fallback', reason: 'currency_mismatch', currency, destCurrency });
    }

    logger.info('[admin/affiliate/commissions/retry] transfer', {
      invoiceId: entry.invoiceId,
      amountCents,
      currency,
      dest: affUser.paymentInfo.stripeAccountId,
    });

    const transfer = await stripe.transfers.create({
      amount: amountCents,
      currency,
      destination: affUser.paymentInfo.stripeAccountId,
      description: entry.note || '',
      metadata: {
        invoiceId: entry.invoiceId || '',
        buyerUserId: entry.buyerUserId ? String(entry.buyerUserId) : '',
        affiliateUserId: String(affUser._id),
        affiliateCode: affUser.affiliateCode || ''
      }
    }, { idempotencyKey: `commission_${entry.invoiceId}_${affUser._id}` });

    // Sucesso → marque como 'paid' (valor permitido no union) e ajuste o saldo
    entry.status = 'paid';
    entry.transactionId = transfer.id;

    affUser.commissionPaidInvoiceIds = affUser.commissionPaidInvoiceIds || [];
    if (entry.invoiceId && !affUser.commissionPaidInvoiceIds.includes(entry.invoiceId)) {
      affUser.commissionPaidInvoiceIds.push(entry.invoiceId);
    }

    // Debita o saldo disponível dessa moeda (sem deixar negativo)
    affUser.affiliateBalances ||= new Map();
    const prev = affUser.affiliateBalances.get(currency) ?? 0;
    affUser.affiliateBalances.set(currency, Math.max(prev - amountCents, 0));

    affUser.markModified('commissionLog');
    affUser.markModified('affiliateBalances');
    await affUser.save();

    return NextResponse.json({ success: true, transactionId: transfer.id });
  } catch (err) {
    logger.error('[admin/affiliate/commissions/retry] error', err);
    return NextResponse.json({ error: 'Erro ao reprocessar comissão' }, { status: 500 });
  }
}
