import { Types } from 'mongoose';
import User from '@/app/models/User';
import Mapa from '@/app/models/MapaSeed';
import { connectToDatabase } from '@/app/lib/mongoose';
import { resolveCreatorAvatar } from '@/app/lib/avatar/creatorAvatar';
import { eligible, compatibleMode, DISCOVERY_FIELDS, discoveryQuery } from './eligibility';
import type { CollabCreativeSignals, EligibleCandidate, NarrativeCandidatePool } from '@/app/dashboard/boards/videoUpload/narrativeCollabMatchingService';
const clean = (value: unknown, limit = 8): string[] => Array.isArray(value) ? value.filter((s): s is string => typeof s === 'string' && !!s.trim()).map(s => s.trim().slice(0, 160)).slice(0, limit) : [];
function creative(mapa: any): CollabCreativeSignals {
  return { themes: clean(mapa?.temas), assets: clean(mapa?.assets), tone: typeof mapa?.tom === 'string' ? mapa.tom : null, formats: clean(mapa?.formatos), visualStyle: [] };
}
/** Só o contexto geral compartilhado na descoberta; diagnósticos privados ficam fora do pool. */
export async function candidatePool(userId: string): Promise<NarrativeCandidatePool | null> {
  if (!Types.ObjectId.isValid(userId)) return null;
  await connectToDatabase();
  const [viewer, ownMap] = await Promise.all([
    User.findById(userId).select(DISCOVERY_FIELDS).lean(),
    Mapa.findOne({ userId: new Types.ObjectId(userId) }).select('mapa').lean(),
  ]);
  if (!eligible(viewer)) return { pool: [], candidateTerritoriesById: new Map(), viewerCreativeSignals: creative(ownMap?.mapa) };
  const now = new Date();
  const pool: EligibleCandidate[] = [], territories = new Map<string, string[]>();
  // Percorre páginas do banco até reunir candidatos válidos. Conta sem mapa ou
  // modalidade incompatível não ocupa uma vaga do corte final.
  const cursor = User.aggregate([
    { $match: { _id: { $ne: new Types.ObjectId(userId) }, ...discoveryQuery(), $or: [{ role: 'admin' }, { planStatus: 'active', $or: [{ cancelAtPeriodEnd: { $ne: true } }, { currentPeriodEnd: { $gt: now } }] }, { planStatus: 'non_renewing', currentPeriodEnd: { $gt: now } }] } },
    { $sort: { collabLastShownAt: 1, _id: 1 } },
    { $lookup: { from: 'mapasseed', localField: '_id', foreignField: 'userId', as: 'mapas' } },
    { $match: { 'mapas.0.mapa.narrativa_central': { $nin: [null, ''] }, 'mapas.0.mapa.territorios.0': { $exists: true } } },
    { $project: { _id: 1, name: 1, username: 1, instagramUsername: 1, image: 1, providerImage: 1, profile_picture_url: 1, mediaKitSlug: 1, location: 1, role: 1, planStatus: 1, currentPeriodEnd: 1, cancelAtPeriodEnd: 1, collabDiscoveryOptIn: 1, collabDiscoveryOptInDate: 1, collabDiscoveryStatus: 1, collabDiscoveryMode: 1, mapas: 1 } },
  ]).cursor({ batchSize: 100 });
  try {
    for await (const user of cursor) {
      const mode = compatibleMode(viewer!, user);
      if (!eligible(user) || !mode) continue;
      const mapa = user.mapas?.[0]?.mapa;
      const labels = clean(mapa?.territorios);
      if (!mapa?.narrativa_central || !labels.length) continue;
      territories.set(String(user._id), labels);
      pool.push({ userId: String(user._id), user: { ...user, mapas: undefined, avatarUrl: resolveCreatorAvatar(user), location: mode === 'remoto' ? null : user.location }, reading: { userId: user._id, videoReading: { title: 'Assuntos compartilhados no Mapa', summary: '', mainNarrative: mapa.narrativa_central }, publishIntent: null }, creativeSignals: creative(mapa) } as EligibleCandidate);
      if (pool.length >= 30) break;
    }
  } finally { await cursor.close(); }

  return { pool, candidateTerritoriesById: territories, viewerCreativeSignals: creative(ownMap?.mapa) };
}
