import type Stripe from 'stripe';
import { connectToDatabase } from '@/app/lib/mongoose';
import { User } from '@/server/db/models/User';
import Redemption from '@/app/models/Redemption';
import mongoose from 'mongoose';

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
      const destination = transfer.destination;
      const accountId = typeof destination === 'string' ? destination : destination?.id;
      if (!accountId) return;

      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          const redemption = await Redemption.findOne({ transferId: transfer.id }).session(session);
          if (!redemption) return;
          if (redemption.accountId && redemption.accountId !== accountId) {
            throw new Error(`Transfer destination mismatch for redemption ${redemption._id}`);
          }

          const reversedTotal = Math.min(
            Number(transfer.amount_reversed || (transfer.reversed ? transfer.amount : 0)),
            redemption.amountCents,
          );
          const previous = Number(redemption.reversedAmountCents || 0);
          const delta = Math.max(0, reversedTotal - previous);
          if (delta === 0) return;

          const now = new Date();
          const currency = String(transfer.currency || redemption.currency).toLowerCase();
          const userUpdate = await User.updateOne(
            { _id: redemption.userId },
            {
              $inc: { [`affiliateBalances.${currency}`]: delta },
              $push: {
                commissionLog: {
                  type: 'adjustment',
                  status: 'available',
                  affiliateUserId: redemption.userId,
                  currency,
                  amountCents: delta,
                  redeemId: redemption._id,
                  transferId: transfer.id,
                  reasonCode: 'transfer_reversed',
                  note: 'Stripe Connect transfer reversal',
                  availableAt: now,
                  maturedAt: now,
                  createdAt: now,
                  updatedAt: now,
                },
              },
            },
            { session },
          );
          if (userUpdate.modifiedCount !== 1) {
            throw new Error(`Affiliate not found for reversed transfer ${transfer.id}`);
          }

          redemption.reversedAmountCents = reversedTotal;
          if (reversedTotal >= redemption.amountCents) {
            redemption.status = 'rejected';
            redemption.reasonCode = 'transfer_reversed';
          } else {
            redemption.reasonCode = 'transfer_partially_reversed';
          }
          await redemption.save({ session });
        });
      } finally {
        await session.endSession();
      }
      break;
    }
    case 'payout.failed': {
      const payout = event.data.object as Stripe.Payout;
      const accountId = event.account as string | undefined;
      if (!accountId) return;

      // A failed bank payout returns funds to the connected Stripe balance; it
      // does not reverse the platform Transfer. Re-crediting the affiliate
      // ledger here would make the same money withdrawable twice.
      await User.updateOne(
        { 'paymentInfo.stripeAccountId': accountId },
        {
          $set: {
            'paymentInfo.stripeAccountStatus': 'disabled',
            'paymentInfo.stripeAccountPayoutsEnabled': false,
            'paymentInfo.stripeAccountDisabledReason': payout.failure_code || 'payout_failed',
          },
        },
      );
      break;
    }
    default:
      break;
  }
}
