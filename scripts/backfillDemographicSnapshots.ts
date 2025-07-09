import 'dotenv/config';
import { connectToDatabase } from '../src/app/lib/mongoose';
import User from '../src/app/models/User';
import { fetchAudienceDemographics } from '../src/app/lib/instagram/api/fetchers';
import AudienceDemographicSnapshot from '../src/app/models/demographics/AudienceDemographicSnapshot';
import { logger } from '../src/app/lib/logger';

async function run() {
  const TAG = '[backfillDemographicSnapshots]';
  await connectToDatabase();
  const users = await User.find({ isInstagramConnected: true, instagramAccountId: { $ne: null } })
    .select('_id instagramAccountId instagramAccessToken')
    .lean();
  logger.info(`${TAG} ${users.length} usuários encontrados para verificação.`);

  for (const u of users) {
    const existing = await AudienceDemographicSnapshot.findOne({ user: u._id }).lean();
    if (existing) {
      logger.info(`${TAG} Usuário ${u._id} já possui demografia registrada. Pulando.`);
      continue;
    }
    if (!u.instagramAccessToken) {
      logger.warn(`${TAG} Usuário ${u._id} sem access token. Impossível coletar demografia.`);
      continue;
    }
    try {
      const res = await fetchAudienceDemographics(u.instagramAccountId as string, u.instagramAccessToken as string);
      if (res.success && res.data) {
        await AudienceDemographicSnapshot.create({
          user: u._id,
          instagramAccountId: u.instagramAccountId,
          recordedAt: new Date(),
          demographics: res.data,
        });
        logger.info(`${TAG} Demografia salva para usuário ${u._id}`);
      } else {
        logger.warn(`${TAG} Falha ao coletar demografia para usuário ${u._id}: ${res.error || res.errorMessage}`);
      }
    } catch (err) {
      logger.error(`${TAG} Erro ao processar usuário ${u._id}`, err);
    }
  }
  logger.info(`${TAG} Processamento concluído.`);
}

run().catch(e => {
  logger.error('[backfillDemographicSnapshots] erro geral', e);
}).finally(() => process.exit(0));
