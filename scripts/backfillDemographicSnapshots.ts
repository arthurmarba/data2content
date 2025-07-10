import 'dotenv/config';
import mongoose from 'mongoose';
import { connectToDatabase } from '../src/app/lib/mongoose';
import User from '../src/app/models/User';
import { fetchAudienceDemographics } from '../src/app/lib/instagram/api/fetchers';
import AudienceDemographicSnapshot from '../src/app/models/demographics/AudienceDemographicSnapshot';
import { logger } from '../src/app/lib/logger';

const DELAY_BETWEEN_USERS_MS = 2000; // Pausa de 2 segundos entre cada usuário
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function run() {
  const TAG = '[backfillDemographicSnapshots]';
  await connectToDatabase();
  const users = await User.find({ isInstagramConnected: true, instagramAccountId: { $ne: null } })
    .select('_id instagramAccountId instagramAccessToken')
    .lean();
  logger.info(`${TAG} ${users.length} usuários encontrados para verificação.`);

  for (const [index, u] of users.entries()) {
    logger.info(`${TAG} Processando usuário ${index + 1}/${users.length} (ID: ${u._id})`);
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
          demographics: res.data.follower_demographics, // Salva o objeto limpo
        });
        logger.info(`${TAG} Demografia salva para usuário ${u._id}`);
      } else {
        logger.warn(`${TAG} Falha ao coletar demografia para usuário ${u._id}: ${res.error || res.errorMessage}`);
      }
    } catch (err) {
      logger.error(`${TAG} Erro ao processar usuário ${u._id}`, err);
    }
    
    // Pausa para não sobrecarregar a API
    await sleep(DELAY_BETWEEN_USERS_MS);
  }
  logger.info(`${TAG} Processamento concluído.`);
}

run().catch(e => {
  logger.error('[backfillDemographicSnapshots] erro geral', e);
}).finally(() => mongoose.disconnect()); // Garante que a conexão seja fechada
