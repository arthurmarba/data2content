import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import User from '@/app/models/User';
import { normalizedBalanceMap, summarizeAffiliateLedger } from '@/server/affiliate/ledger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MIN_BY_CUR: Record<string, number> = {
  BRL: Number(process.env.AFFILIATE_MIN_REDEEM_BRL ?? 5000),
  USD: Number(process.env.AFFILIATE_MIN_REDEEM_USD ?? 1000),
};
const minRedeemFor = (cur: string) =>
  MIN_BY_CUR[cur] ?? Number(process.env.AFFILIATE_MIN_REDEEM_DEFAULT ?? 5000);

export async function GET() {
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

  const currencies = new Set<string>([
    ...Object.keys(balances),
    ...Object.keys(ledger),
    ...Object.keys(debt),
  ]);

  const byCurrency: Record<string, any> = {};

  currencies.forEach((cur) => {
    const ledgerSummary = ledger[cur] || { availableCents: 0, pendingCents: 0, nextMatureAt: null };
    const storedAvailableCents = balances[cur] ?? 0;
    const debtCents = debt[cur] ?? 0;

    byCurrency[cur] = {
      availableCents: ledgerSummary.availableCents,
      storedAvailableCents,
      reconciliationStatus:
        storedAvailableCents === ledgerSummary.availableCents ? 'reconciled' : 'mismatch',
      pendingCents: ledgerSummary.pendingCents,
      debtCents,
      nextMatureAt: ledgerSummary.nextMatureAt,
      minRedeemCents: minRedeemFor(cur),
    };
  });

  return NextResponse.json(
    { byCurrency },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  );
}
