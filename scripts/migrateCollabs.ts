/** Migração aditiva e retomável. Sem --apply, somente contagens; nunca chama IA. */
import mongoose from 'mongoose';
import { connectToDatabase } from '@/app/lib/mongoose';
async function main() {
  const apply = process.argv.includes('--apply');
  mongoose.set('autoIndex', false); mongoose.set('autoCreate', false);
  await connectToDatabase();
  const db = mongoose.connection.db!;
  const interests = db.collection('collabinterests');
  const filter = { matchedAt: { $ne: null }, expiresAt: { $ne: null } };
  const snapshot = { mode: apply ? 'apply' : 'dry-run', confirmedWithExpiry: await interests.countDocuments(filter),
    unresolvedPartner: await interests.countDocuments({ partner: null }), ambiguousDiscovery: await db.collection('users').countDocuments({ collabDiscoveryOptIn: { $ne: true }, collabDiscoveryStatus: { $ne: 'paused' } }),
    legacyMatches: await db.collection('collabmatches').countDocuments({}), legacyCache: await db.collection('perpautacollabcaches').countDocuments({}),
  };
  console.log(JSON.stringify(snapshot, null, 2));
  if (!apply) return;
  const [{ default: Proposal }, { default: Job }, { default: Quota }, { default: Settings }] = await Promise.all([import('@/app/models/CollabProposal'), import('@/app/models/CollabJob'), import('@/app/models/ContentIdeaQuota'), import('@/app/models/CollabSettings')]);
  // Protege combinações anteriores contra a expiração acidental; não cria aceites.
  await interests.updateMany(filter, { $unset: { expiresAt: '' } });
  for (const model of [Proposal, Job, Quota, Settings]) await model.createIndexes();
  await Settings.updateOne({ _id: 'default' }, { $setOnInsert: { generationEnabled: false, pilotUserIds: [], whatsappTemplateApproved: false, whatsappTemplate: null } }, { upsert: true });
  console.log('Índices preparados; geração permanece no estado já configurado. Consentimentos e pautas preservados. Caches legados não são usados pelo motor novo.');
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'migration_failed'); process.exitCode = 1; }).finally(() => mongoose.disconnect());
