import 'dotenv/config';
import mongoose from 'mongoose';
import { connectToDatabase } from '../src/app/lib/mongoose';
import User from '../src/app/models/User';
import { fetchFollowerDemographics } from '../src/services/instagramInsightsService'; 
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
      const data = await fetchFollowerDemographics(u.instagramAccountId as string, u.instagramAccessToken as string);
      
      await AudienceDemographicSnapshot.create({
        user: u._id,
        instagramAccountId: u.instagramAccountId,
        recordedAt: new Date(),
        // CORREÇÃO FINAL: Envolve os dados na estrutura correta que o schema espera.
        demographics: {
          follower_demographics: data.follower_demographics,
        },
      });
      logger.info(`${TAG} Demografia salva para usuário ${u._id}`);
      
    } catch (err) {
      logger.error(`${TAG} Erro ao processar usuário ${u._id}`, err);
    }
    
    await sleep(DELAY_BETWEEN_USERS_MS);
  }
  logger.info(`${TAG} Processamento concluído.`);
}

run().catch(e => {
  logger.error('[backfillDemographicSnapshots] erro geral', e);
}).finally(() => mongoose.disconnect());
