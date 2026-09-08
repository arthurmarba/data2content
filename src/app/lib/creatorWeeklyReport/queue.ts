import { Client } from '@upstash/qstash';
import { Types } from 'mongoose';
import { logger } from '@/app/lib/logger';
import Metric from '@/app/models/Metric';
import User from '@/app/models/User';
import State from '@/app/models/ContentReadingState';
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

/** O cron continua a recuperar falhas; a classificação concluída entrega o post
 * diretamente à leitura, respeitando acesso, versão e a pausa do provedor. */
export async function enqueuePublishedReading(metricId: string) {
  if (!Types.ObjectId.isValid(metricId)) return false;
  try {
    await connectToDatabase();
    const metric = await Metric.findById(metricId).select('user type postDate instagramMediaId').lean();
    if (!metric || !metric.instagramMediaId || !['REEL', 'VIDEO', 'IMAGE', 'CAROUSEL_ALBUM'].includes(metric.type ?? '')) return false;
    if (new Date(metric.postDate).getTime() < Date.now() - 90 * 86400000) return false;
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
