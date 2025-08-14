import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import User from '@/app/models/User';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MIN_BY_CUR: Record<string, number> = {
  BRL: Number(process.env.AFFILIATE_MIN_REDEEM_BRL ?? 5000),
  USD: Number(process.env.AFFILIATE_MIN_REDEEM_USD ?? 1000),
};
const minRedeemFor = (cur: string) =>
  MIN_BY_CUR[cur] ?? Number(process.env.AFFILIATE_MIN_REDEEM_DEFAULT ?? 5000);

function normalize(obj: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  Object.keys(obj || {}).forEach((k) => {
    out[k.toUpperCase()] = obj[k];
  });
  return out;
}

export async function GET() {
  const session = await getServerSession(authOptions);
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

  const balances = normalize(Object.fromEntries(user.affiliateBalances || []));
  const debt = normalize(Object.fromEntries(user.affiliateDebtByCurrency || []));
  const commissions = user.commissionLog || [];

  const currencies = new Set<string>([
    ...Object.keys(balances),
    ...commissions.map((c: any) => String(c.currency).toUpperCase()),
    ...Object.keys(debt),
  ]);

  const now = Date.now();
  const byCurrency: Record<string, any> = {};

  currencies.forEach((cur) => {
    const availableCents = balances[cur] ?? 0;
    const pendingItems = commissions.filter(
      (c: any) => String(c.currency).toUpperCase() === cur && c.status === 'pending'
    );
    const pendingCents = pendingItems.reduce(
      (sum: number, i: any) => sum + (i.amountCents || 0),
      0
    );
    const next = pendingItems
      .map((i: any) => i.availableAt)
      .filter((d: any) => d && new Date(d).getTime() > now)
      .reduce<number | null>((acc, d: any) => {
        const t = new Date(d).getTime();
        return acc === null || t < acc ? t : acc;
      }, null);
    const nextMatureAt = next ? new Date(next).toISOString() : null;
    const debtCents = debt[cur] ?? 0;

    byCurrency[cur] = {
      availableCents,
      pendingCents,
      debtCents,
      nextMatureAt,
      minRedeemCents: minRedeemFor(cur),
    };
  });

  return NextResponse.json(
    { byCurrency },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  );
}
