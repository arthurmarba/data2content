import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import User from '@/app/models/User';
import stripe from '@/app/lib/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  await connectToDatabase();
  const user = await User.findById(session.user.id, {
    projection: { 'paymentInfo.stripeAccountId': 1 },
  }).lean();

  let payoutsEnabled = false;
  let needsOnboarding = true;
  let isUnderReview = false;
  let defaultCurrency: string | null = null;
  let disabledReasonKey: string | null = null;
  let accountCountry: string | null = null;

  if (user?.paymentInfo?.stripeAccountId) {
    const acct = await stripe.accounts.retrieve(user.paymentInfo.stripeAccountId);
    payoutsEnabled = !!acct.payouts_enabled;
    defaultCurrency = acct.default_currency?.toUpperCase() ?? null;
    accountCountry = acct.country ?? null;
    const req: any = acct.requirements ?? {};
    needsOnboarding = !!(
      req.currently_due?.length ||
      req.past_due?.length ||
      req.eventually_due?.length
    );
    isUnderReview =
      (acct.future_requirements?.currently_due?.length ?? 0) === 0 &&
      !acct.payouts_enabled &&
      req.disabled_reason === 'under_review';
    disabledReasonKey = req.disabled_reason ?? null;
  }

  return NextResponse.json(
    {
      payoutsEnabled,
      needsOnboarding,
      isUnderReview,
      defaultCurrency,
      disabledReasonKey,
      accountCountry,
      lastRefreshedAt: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  );
}
