// scripts/migrateAffiliateBalances.ts

import { connectToDatabase } from '@/app/lib/mongoose';
import User from '@/app/models/User';
import { normCur } from '@/utils/normCur';

(async () => {
  try {
    console.log('[migrateAffiliateBalances] Conectando ao banco...');
    await connectToDatabase();

    const users = await User.find({});
    console.log(`[migrateAffiliateBalances] ${users.length} usuários encontrados.`);

    let updated = 0;

    for (const u of users) {
      // Soma por moeda (em cents) apenas de entradas fallback/failed com dados válidos
      const map = new Map<string, number>();

      for (const e of u.commissionLog || []) {
        if (['available'].includes(e.status) && e.amountCents && e.currency) {
          const cur = normCur(e.currency);
          map.set(cur, (map.get(cur) ?? 0) + e.amountCents);
        }
      }

      // Atualiza o Map por moeda
      u.affiliateBalances = map;
      u.markModified('affiliateBalances');

      // Zera campos legados SEM depender da interface TS
      (u as any).set('affiliateBalance', 0);
      (u as any).set('affiliateBalanceCents', 0);

      await u.save();
      updated += 1;

      if (updated % 50 === 0) {
        console.log(`[migrateAffiliateBalances] ${updated} usuários migrados...`);
      }
    }

    console.log(`[migrateAffiliateBalances] Migração concluída. Usuários atualizados: ${updated}.`);
    process.exit(0);
  } catch (err) {
    console.error('[migrateAffiliateBalances] Erro na migração:', err);
    process.exit(1);
  }
})();
