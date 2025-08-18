import type Stripe from 'stripe';
import { connectToDatabase } from '@/app/lib/mongoose';
import { User } from '@/server/db/models/User';
import Redemption from '@/app/models/Redemption';
import { adjustBalance } from '@/server/affiliate/balance';

export async function handleStripeConnectEvent(event: Stripe.Event) {
  await connectToDatabase();

  switch (event.type) {
    case 'account.updated': {
      const account = event.data.object as Stripe.Account;
      const accountId = account.id;
      if (!accountId) return;

      const user = await User.findOne({ 'paymentInfo.stripeAccountId': accountId });
      if (!user) return;

      user.paymentInfo ||= {};

      const payoutsEnabled = !!account.payouts_enabled;
      const chargesEnabled = !!account.charges_enabled;
      const defaultCurrency = account.default_currency?.toUpperCase();
      const disabledReason =
        (account.requirements as any)?.disabled_reason ||
        (account as any).disabled_reason ||
        null;
      const needsOnboarding = !!(
        account.requirements?.currently_due?.length ||
        account.requirements?.past_due?.length ||
        account.requirements?.eventually_due?.length
      );
      const status = disabledReason
        ? 'disabled'
        : payoutsEnabled && chargesEnabled && !!account.details_submitted
        ? 'verified'
        : 'pending';

      user.paymentInfo.stripeAccountStatus = status;
      user.paymentInfo.stripeAccountDefaultCurrency = defaultCurrency;
      user.paymentInfo.stripeAccountPayoutsEnabled = payoutsEnabled;
      user.paymentInfo.stripeAccountChargesEnabled = chargesEnabled;
      user.paymentInfo.stripeAccountDisabledReason = disabledReason;
      user.paymentInfo.stripeAccountCapabilities = {
        card_payments: account.capabilities?.card_payments,
        transfers: account.capabilities?.transfers,
      } as any;
      user.paymentInfo.stripeAccountNeedsOnboarding = needsOnboarding;
      user.paymentInfo.stripeAccountCountry = account.country ?? null;

      await user.save();
      break;
    }
    // ATUALIZAÇÃO APLICADA AQUI
    case 'transfer.reversed': {
      const transfer = event.data.object as Stripe.Transfer;
      const accountId = event.account as string | undefined;
      if (!accountId) return;

      const user = await User.findOne({ 'paymentInfo.stripeAccountId': accountId });
      if (!user) return;

      const redemption = await Redemption.findOne({ transferId: transfer.id });
      if (redemption && redemption.status === 'paid') {
        await adjustBalance(user, transfer.currency, transfer.amount);
        redemption.status = 'rejected';
        redemption.reasonCode = 'transfer_reversed'; // Este código já estava correto
        await redemption.save();
        await user.save();
      }
      break;
    }
    case 'payout.failed': {
      const payout = event.data.object as Stripe.Payout;
      const accountId = event.account as string | undefined;
      // CORREÇÃO APLICADA AQUI para resolver o erro de tipo
      const transferId =
        typeof (payout as any).source_transaction === 'string'
          ? (payout as any).source_transaction
          : null;
      if (!accountId || !transferId) return;

      const user = await User.findOne({ 'paymentInfo.stripeAccountId': accountId });
      if (!user) return;

      const redemption = await Redemption.findOne({ transferId });
      if (redemption && redemption.status === 'paid') {
        await adjustBalance(user, payout.currency, payout.amount);
        redemption.status = 'rejected';
        redemption.reasonCode = 'payout_rejected';
        await redemption.save();
        await user.save();
      }
      break;
    }
    default:
      break;
  }
}
