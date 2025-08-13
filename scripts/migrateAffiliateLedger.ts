import { connectToDatabase } from '@/app/lib/mongoose';
import User from '@/app/models/User';
import mongoose from 'mongoose';

const statusMap: Record<string, any> = {
  accrued: 'available',
  paid: 'paid',
  failed: 'canceled',
  fallback: 'available',
};

async function run() {
  await connectToDatabase();
  const users = await User.find({});
  for (const u of users) {
    let changed = false;
    const entries: any[] = [];
    for (const e of (u as any).commissionLog || []) {
      if (e.type) {
        // normalize currency
        if (e.currency) e.currency = String(e.currency).toLowerCase();
        entries.push(e);
        continue;
      }
      const cur = String(e.currency || 'brl').toLowerCase();
      entries.push({
        type: 'commission',
        status: statusMap[e.status as string] || 'available',
        invoiceId: e.invoiceId || e.sourcePaymentId,
        subscriptionId: e.subscriptionId,
        affiliateUserId: u._id,
        buyerUserId: e.referredUserId || e.buyerUserId,
        currency: cur,
        amountCents: e.amountCents || 0,
        availableAt: e.availableAt,
        transactionId: e.transactionId,
        note: e.description,
        createdAt: e.date || new Date(),
        updatedAt: e.date || new Date(),
      });
      changed = true;
    }
    if (changed) {
      (u as any).commissionLog = entries;
      // recompute balances from available entries
      const balances: Record<string, number> = {};
      for (const e of entries) {
        if (e.status === 'available') {
          balances[e.currency] = (balances[e.currency] || 0) + e.amountCents;
        } else if (e.status === 'paid' || e.status === 'reversed') {
          balances[e.currency] = (balances[e.currency] || 0) - e.amountCents;
        }
      }
      u.affiliateBalances = new Map(Object.entries(balances));
      await u.save();
    }
  }
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('migration error', err);
  process.exit(1);
});
