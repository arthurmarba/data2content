import mongoose from 'mongoose';
import { buildProfileEvolution } from '../src/app/lib/creatorWeeklyReport/evolution';
import { buildCreatorWeeklyReport, type CreatorWeeklyReportMetricInput } from '../src/app/lib/creatorWeeklyReport/engine';
import { lastClosedWeek } from '../src/app/lib/relatorio/weekWindow';

// Somente leitura: não importa serviços de geração, não enfileira e não usa IA.
const userId = process.argv.find(arg => arg.startsWith('--user-id='))?.split('=')[1];
const limit = Math.min(50, Math.max(1, Number(process.argv.find(arg => arg.startsWith('--limit='))?.split('=')[1] ?? 12)));
if (userId && !mongoose.Types.ObjectId.isValid(userId)) throw new Error('ID de usuário inválido.');
if (!Number.isFinite(limit)) throw new Error('Limite inválido.');
if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI não configurada.');
await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.MONGODB_DB_NAME || process.env.DB_NAME || 'data2content', serverSelectionTimeoutMS: 15000 });
try {
  const db = mongoose.connection.db!;
  const now = new Date();
  const week = lastClosedWeek(now);
  const users = await db.collection('users').find(userId ? { _id: new mongoose.Types.ObjectId(userId) } : { isInstagramConnected: true, planStatus: { $in: ['active', 'non_renewing'] } }, { projection: { _id: 1, lastInstagramSyncSuccess: 1, lastInstagramSyncAttempt: 1 } }).sort({ _id: 1 }).limit(limit).toArray();
  const provider = await db.collection('content_reading_states').findOne({ _id: 'provider:gemini' as any }, { projection: { state: 1, reason: 1, nextAttemptAt: 1 } });
  const accounts = [];
  for (const user of users) {
    const metrics = await db.collection('metrics').find({ user: user._id, postDate: { $gte: week.windowStartsAt, $lte: now } }, { projection: { instagramMediaId: 1, postLink: 1, postDate: 1, type: 1, stats: 1, sceneElements: 1, classificationStatus: 1, classificationError: 1, createdAt: 1 } }).toArray();
    const states = await db.collection('content_reading_states').find({ _id: { $in: metrics.map(row => String(row._id)) } as any }, { projection: { _id: 1, state: 1, reason: 1, nextAttemptAt: 1 } }).toArray();
    const points = await db.collection('daily_metric_snapshots').aggregate([
      { $match: { metric: { $in: metrics.map(row => row._id) }, date: { $gte: week.windowStartsAt, $lte: now } } },
      { $lookup: { from: 'metrics', localField: 'metric', foreignField: '_id', as: 'post', pipeline: [{ $project: { postDate: 1 } }] } }, { $unwind: '$post' },
      { $match: { $expr: { $and: [{ $gte: [{ $subtract: ['$date', '$post.postDate'] }, 7 * 86400000] }, { $lte: [{ $subtract: ['$date', '$post.postDate'] }, 9 * 86400000] }] } } },
      { $sort: { date: 1 } }, { $group: { _id: '$metric', shares: { $first: '$cumulativeShares' }, saved: { $first: '$cumulativeSaved' }, views: { $first: '$cumulativeViews' } } },
    ]).toArray();
    const pointById = new Map(points.map(point => [String(point._id), point]));
    const source = metrics.map(row => ({ ...row, d7Stats: pointById.get(String(row._id)) ?? null })) as unknown as CreatorWeeklyReportMetricInput[];
    const evolution = buildProfileEvolution({ metrics: source, week, now, states: states as any, providerPaused: Boolean(provider && provider.state !== 'healthy'), metricsSyncedAt: user.lastInstagramSyncSuccess === true ? user.lastInstagramSyncAttempt : null });
    const report = buildCreatorWeeklyReport({ metrics: source, week, generatedAt: now });
    accounts.push({ userId: String(user._id), status: evolution.status, windows: evolution.windows, d7Available: points.length,
      candidatePatterns: report.details.flatMap(detail => detail.groups.flatMap(group => group.items.filter(item => item.candidateConsistent).map(item => ({ group: group.id, posts: item.nPosts })))),
      pendingClosedWeek: metrics.filter(row => row.postDate >= week.startsAt && row.postDate <= week.endsAt && !row.sceneElements?.version).map(row => {
        const state = states.find(item => String(item._id) === String(row._id));
        return { postId: String(row._id), publishedAt: row.postDate, importedAt: row.createdAt, classification: row.classificationStatus, readingState: state?.state ?? 'pending', reason: state?.reason ?? (row.classificationStatus !== 'completed' ? 'classification_pending' : provider?.reason ?? 'not_queued'), nextAttemptAt: state?.nextAttemptAt ?? provider?.nextAttemptAt ?? null };
      }),
    });
  }
  console.log(JSON.stringify({ auditedAt: now, policy: 'perfil_evidencia_v2_piloto', readOnly: true, provider, accounts }, null, 2));
} finally { await mongoose.disconnect(); }
