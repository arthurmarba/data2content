import { Client } from '@upstash/qstash';
import { Types } from 'mongoose';
import { logger } from '@/app/lib/logger';
import Metric from '@/app/models/Metric';
import User from '@/app/models/User';
import State from '@/app/models/ContentReadingState';
import Evidence from '@/app/models/PublishedContentEvidence';
import { readingRevision } from '@/app/lib/relatorio/readingRevision';
import { connectToDatabase } from '@/app/lib/mongoose';

async function publish(path: string, body: Record<string, string>, deduplicationId: string, delay = 20) {
  const token = process.env.QSTASH_TOKEN;
  const base = (process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
  if (!token || !/^https?:\/\//.test(base)) return false;
  try {
    await new Client({ token }).publishJSON({ url: `${base}/api/worker/${path}`, body, deduplicationId, delay, retries: 2 });
    return true;
  } catch (error) {
    logger.warn('[perfil][falha_fila]', { path, error: String(error) });
    return false;
  }
}

export async function enqueueProfileRefresh(userId: string) {
  if (!Types.ObjectId.isValid(userId)) return false;
  return publish('generate-creator-weekly-report', { userId }, `perfil-${userId}-${Math.floor(Date.now() / 60000)}`);
}

export async function enqueueInstagramMapEnrichment(userId: string) {
  if (!Types.ObjectId.isValid(userId)) return false;
  return publish('enrich-mapa-instagram', { userId }, `mapa-instagram-${userId}-${Math.floor(Date.now() / 300000)}`, 30);
}

/** Conexão nova: os posts recentes entram na leitura no ato, sem esperar a repescagem
 * de 6 em 6 horas. Cada post ainda passa pelas travas de acesso, versão e saldo, e
 * quem já foi lido é ignorado — chamar de novo numa reconexão não gasta nada. */
export async function enqueueOnboardingReadings(userId: string, limit = 30): Promise<number> {
  if (!Types.ObjectId.isValid(userId)) return 0;
  await connectToDatabase();
  const posts = await Metric.find({
    user: userId,
    postDate: { $gte: new Date(Date.now() - 90 * 86400000) },
    instagramMediaId: { $nin: [null, ''] },
    type: { $in: ['REEL', 'VIDEO', 'IMAGE', 'CAROUSEL_ALBUM'] },
  }).sort({ postDate: -1 }).limit(limit).select('_id').lean();
  let enfileirados = 0;
  for (const post of posts) if (await enqueuePublishedReading(String(post._id))) enfileirados += 1;
  return enfileirados;
}

/** O cron continua a recuperar falhas; a classificação concluída entrega o post
 * diretamente à leitura, respeitando acesso, versão e a pausa do provedor. */
export async function enqueuePublishedReading(metricId: string) {
  if (!Types.ObjectId.isValid(metricId)) return false;
  try {
    await connectToDatabase();
    const metric = await Metric.findById(metricId).select('user type postDate instagramMediaId sceneElements.version').lean();
    if (!metric || !metric.instagramMediaId || !['REEL', 'VIDEO', 'IMAGE', 'CAROUSEL_ALBUM'].includes(metric.type ?? '')) return false;
    if (new Date(metric.postDate).getTime() < Date.now() - 90 * 86400000) return false;
    if (metric.sceneElements?.version === readingRevision(metric.type) && await Evidence.exists({ metricId, userId: metric.user })) return false;
    const user = await User.findById(metric.user).select('isInstagramConnected planStatus currentPeriodEnd cancelAtPeriodEnd').lean();
    const active = user?.planStatus === 'active' && (user.cancelAtPeriodEnd !== true || (user.currentPeriodEnd && new Date(user.currentPeriodEnd) > new Date()));
    const nonRenewing = user?.planStatus === 'non_renewing' && user.currentPeriodEnd && new Date(user.currentPeriodEnd) > new Date();
    if (!user?.isInstagramConnected || !(active || nonRenewing)) return false;
    const provider = await State.findById('provider:gemini').select('state nextAttemptAt').lean();
    if (provider && provider.state !== 'healthy' && provider.nextAttemptAt > new Date()) return false;
    return publish('classify-published-scene', { metricId }, `perfil-cena-${metricId}-${Math.floor(Date.now() / 3600000)}`);
  } catch (error) {
    logger.warn('[perfil][falha_encadeamento_leitura]', { metricId, error: String(error) });
    return false;
  }
}
