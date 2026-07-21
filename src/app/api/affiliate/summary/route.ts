import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { connectToDatabase } from '@/app/lib/mongoose';
import User from '@/app/models/User';
import Redemption from '@/app/models/Redemption';
import { normalizedBalanceMap, summarizeAffiliateLedger } from '@/server/affiliate/ledger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MIN_BY_CUR: Record<string, number> = {
  BRL: Number(process.env.AFFILIATE_MIN_REDEEM_BRL ?? 5000),
  USD: Number(process.env.AFFILIATE_MIN_REDEEM_USD ?? 1000),
};
const minRedeemFor = (cur: string) =>
  MIN_BY_CUR[cur] ?? Number(process.env.AFFILIATE_MIN_REDEEM_DEFAULT ?? 5000);

async function loadAuthOptions() {
  if (process.env.NODE_ENV === 'test') return {} as any;
  const mod = await import('@/app/api/auth/[...nextauth]/route');
  return mod.authOptions as any;
}

export async function GET() {
  const authOptions = await loadAuthOptions();
  const session = (await getServerSession(authOptions)) as any;
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  await connectToDatabase();
  const user = await User.findById(session.user.id).select(
    'affiliateBalances commissionLog affiliateDebtByCurrency'
  );
  if (!user) {
    return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
  }

  const balances = normalizedBalanceMap(user.affiliateBalances);
  const debt = normalizedBalanceMap(user.affiliateDebtByCurrency);
  const commissions = user.commissionLog || [];
  const ledger = summarizeAffiliateLedger(commissions, new Date());
  const activeRedemptions = await Redemption.find({
    userId: user._id,
    status: 'requested',
  }).select('_id currency amountCents balanceReservedAt').lean();
  const activeByCurrency = Object.fromEntries(
    activeRedemptions.map((redemption: any) => [
      String(redemption.currency || '').toUpperCase(),
      redemption,
    ]),
  );

  const currencies = new Set<string>([
    ...Object.keys(balances),
    ...Object.keys(ledger),
    ...Object.keys(debt),
    ...Object.keys(activeByCurrency),
  ]);

  const byCurrency: Record<string, any> = {};

  currencies.forEach((cur) => {
    const ledgerSummary = ledger[cur] || { availableCents: 0, pendingCents: 0, nextMatureAt: null };
    const storedAvailableCents = balances[cur] ?? 0;
    const debtCents = debt[cur] ?? 0;
    const activeRedemption: any = activeByCurrency[cur] || null;
    const reservedCents = activeRedemption?.balanceReservedAt
      ? Number(activeRedemption.amountCents || 0)
      : 0;
    const expectedStoredCents = Math.max(ledgerSummary.availableCents - reservedCents, 0);

    byCurrency[cur] = {
      availableCents: ledgerSummary.availableCents,
      storedAvailableCents,
      reconciliationStatus:
        storedAvailableCents === expectedStoredCents ? 'reconciled' : 'mismatch',
      pendingCents: ledgerSummary.pendingCents,
      debtCents,
      nextMatureAt: ledgerSummary.nextMatureAt,
      minRedeemCents: minRedeemFor(cur),
      activeRedemption: activeRedemption
        ? {
            id: String(activeRedemption._id),
            amountCents: Number(activeRedemption.amountCents || 0),
            balanceReserved: Boolean(activeRedemption.balanceReservedAt),
          }
        : null,
    };
  });

  return NextResponse.json(
    { byCurrency },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  );
}
