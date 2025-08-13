import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import User from '@/app/models/User';

export const runtime = 'nodejs';

function minForCurrency(cur: string) {
  const upper = cur.toUpperCase();
  const fromEnv = Number(process.env[`REDEEM_MIN_${upper}`] || 0);
  return fromEnv > 0 ? Math.round(fromEnv) : 50 * 100;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  await connectToDatabase();
  const user = await User.findById(session.user.id);
  if (!user) {
    return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
  }

  const balances = Object.fromEntries(user.affiliateBalances || []);
  const debt = Object.fromEntries(user.affiliateDebtByCurrency || []);
  const min: Record<string, number> = {};
  const currencies = new Set([...Object.keys(balances), ...Object.keys(debt)]);
  currencies.forEach(cur => {
    min[cur] = minForCurrency(cur);
  });

  return NextResponse.json({ balances, debt, min });
}
