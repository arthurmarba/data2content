import { connectToDatabase } from '@/app/lib/mongoose';
import User from '@/app/models/User';
import { normCur } from '@/utils/normCur';

(async () => {
  await connectToDatabase();
  const users = await User.find({});
  for (const u of users) {
    const map = new Map<string, number>();
    for (const e of u.commissionLog || []) {
      if (['fallback','failed'].includes(e.status) && e.amountCents && e.currency) {
        const cur = normCur(e.currency);
        map.set(cur, (map.get(cur) ?? 0) + e.amountCents);
      }
    }
    u.affiliateBalances = map;
    u.markModified('affiliateBalances');
    u.affiliateBalance = 0;
    u.affiliateBalanceCents = 0;
    await u.save();
  }
  process.exit(0);
})();
