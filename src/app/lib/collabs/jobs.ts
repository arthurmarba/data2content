import crypto from 'node:crypto';
import mongoose, { Types } from 'mongoose';
import { Client } from '@upstash/qstash';
import Job, { type CollabJobRecord } from '@/app/models/CollabJob';
import Quota from '@/app/models/ContentIdeaQuota';
import Idea from '@/app/models/CreatorContentIdea';
import User from '@/app/models/User';
import { connectToDatabase } from '@/app/lib/mongoose';
import { canGenerate, collabSettings } from './settings';
import { premium } from './eligibility';

export function quotaWindow(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end, month: start.toISOString().slice(0, 7) };
}
export async function quotaStatus(userId: string) {
  await connectToDatabase();
  const user = await User.findById(userId).select('role planStatus currentPeriodEnd cancelAtPeriodEnd').lean();
  const limit = user?.role === 'admin' ? Number.MAX_SAFE_INTEGER : premium(user) ? 30 : 3;
  const { start, end, month } = quotaWindow();
  const key = `${userId}:${month}`;
  let ledger = await Quota.findById(key).lean();
  if (!ledger) {
    // Timestamp exato é o identificador de lote legado, inclusive quando há 1 ou 6 pautas.
    const batches = await Idea.distinct('generatedAt', { userId: new Types.ObjectId(userId), generationJobId: null, generatedAt: { $gte: start, $lt: end } });
    ledger = await Quota.findOneAndUpdate({ _id: key }, { $setOnInsert: { userId, month, consumed: batches.length, reserved: [] } }, { upsert: true, new: true }).lean();
  }
  return { key, limitBatches: limit, usedBatches: ledger!.consumed, reservedBatches: ledger!.reserved.length, resetAt: end.toISOString(), isPro: premium(user) };
}
export async function publishJob(id: string) {
  const token = process.env.QSTASH_TOKEN;
  const base = (process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
  if (!token || !/^https?:\/\//.test(base)) return false;
  try {
    await new Client({ token }).publishJSON({ url: `${base}/api/worker/collabs`, body: { jobId: id }, deduplicationId: `collabs:${id}:${Math.floor(Date.now() / 60000)}`, retries: 2 });
    return true;
  } catch { return false; }
}
export async function requestJob(userId: string, kind: 'ideas' | 'matching', payload: Record<string, unknown>, requestKey: string) {
  await connectToDatabase();
  const activeKey = `${kind}:${userId}`;
  const key = `${activeKey}:${requestKey}`;
  const existing = await Job.findOne({ $or: [{ key }, { activeKey }] }).lean();
  if (existing) return existing;
  const quota = kind === 'ideas' ? await quotaStatus(userId) : null;
  const matchLimit = kind === 'matching' ? (await collabSettings()).maxMatchingJobsPerDay : 0;
  const matchBudgetKey = `matching:${userId}:${new Date().toISOString().slice(0, 10)}`;
  if (kind === 'matching') await Quota.updateOne({ _id: matchBudgetKey }, { $setOnInsert: { userId, month: new Date().toISOString().slice(0, 10), consumed: 0, reserved: [] } }, { upsert: true });
  const id = new Types.ObjectId();
  let created: CollabJobRecord | null = null;
  try {
    await mongoose.connection.transaction(async session => {
      if (kind === 'matching') {
        const reserved = await Quota.updateOne({ _id: matchBudgetKey, consumed: { $lt: matchLimit } }, { $inc: { consumed: 1 } }, { session });
        if (!reserved.modifiedCount) throw new Error('matching_budget_exceeded');
      }
      if (quota) {
        const reserved = await Quota.updateOne({ _id: quota.key, $expr: { $lt: [{ $add: ['$consumed', { $size: '$reserved' }] }, quota.limitBatches] } }, { $addToSet: { reserved: String(id) } }, { session });
        if (!reserved.modifiedCount) throw new Error('quota_exceeded');
      }
      const [doc] = await Job.create([{ _id: id, key, activeKey, userId, kind, payload: { ...payload, ...(quota ? { count: Math.max(1, Math.min(Math.floor(Number(payload.count)) || 3, quota.isPro ? 6 : 3)) } : {}) }, state: 'queued', quotaKey: quota?.key }], { session });
      created = doc!.toObject();
    });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return (await Job.findOne({ $or: [{ key }, { activeKey }] }).lean())!;
    throw error;
  }
  await publishJob(String(id)); // Publicação pode ser recuperada pelo cron sem perder o pedido.
  return created!;
}
export function jobPublic(job: CollabJobRecord) {
  return { id: String(job._id), kind: job.kind, state: job.state, reason: job.error ? (/map|narrative|territories/.test(job.error) ? 'map_incomplete' : 'processing_failed') : null, updatedAt: job.updatedAt.toISOString(), ...(job.state === 'completed' ? { result: job.result } : {}) };
}
export async function readJob(userId: string, id: string) {
  if (!Types.ObjectId.isValid(id)) return null;
  await connectToDatabase();
  const job = await Job.findOne({ _id: id, userId }).lean();
  return job ? jobPublic(job) : null;
}
async function finish(job: CollabJobRecord, leaseToken: string, result: Record<string, unknown> | null, error?: string) {
  await mongoose.connection.transaction(async session => {
    const committed = await Job.updateOne({ _id: job._id, state: 'running', leaseToken }, { $set: { state: error ? 'failed' : 'completed', result: result ?? {}, error }, $unset: { activeKey: 1, leaseToken: 1, leaseUntil: 1 } }, { session });
    if (committed.modifiedCount && job.quotaKey) {
      await Quota.updateOne({ _id: job.quotaKey, reserved: String(job._id) }, { $pull: { reserved: String(job._id) }, ...(!error ? { $inc: { consumed: 1 } } : {}) }, { session });
    }
  });
}
export async function processJob(id: string) {
  if (!Types.ObjectId.isValid(id)) return { processed: false };
  await connectToDatabase();
  const now = new Date(), leaseToken = crypto.randomUUID();
  const job = await Job.findOneAndUpdate({ _id: id, attempts: { $lt: 3 }, nextAttemptAt: { $lte: now }, $or: [{ state: 'queued' }, { state: 'running', leaseUntil: { $lte: now } }] }, { $set: { state: 'running', leaseToken, leaseUntil: new Date(now.getTime() + 180000) }, $inc: { attempts: 1 } }, { new: true }).lean();
  if (!job) return { processed: false };
  try {
    if (job.kind !== 'notification' && !(await canGenerate(job.userId))) throw new Error('generation_paused');
    let result: Record<string, unknown>;
    if (job.kind === 'ideas') {
      const { generateIdeasForUser } = await import('./ideaGeneration');
      const delivered = await Idea.exists({ generationJobId: String(job._id), userId: new Types.ObjectId(job.userId) });
      const generated = delivered ? { status: 200, data: { ok: true, recovered: true } } : await generateIdeasForUser(job.userId, job.payload, String(job._id));
      if (generated.status >= 400) throw new Error(String(generated.data.reason || 'generation_failed'));
      result = generated.data;
    } else if (job.kind === 'matching') {
      const { prepareProposals } = await import('./matching');
      result = await prepareProposals(job.userId);
    } else {
      const { deliverMatchNotification } = await import('./notifications');
      result = await deliverMatchNotification(job);
    }
    await finish(job, leaseToken, result);
    return { processed: true };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'processing_failed';
    // Checkpoint existe quando a IA já entregou texto. Falhas permanentes não repetem gasto.
    const retryable = /network|timeout|ECONN|storage|persistence|notification_pending|notification_failed/i.test(reason);
    if (retryable && job.attempts < 3) {
      await Job.updateOne({ _id: id, leaseToken }, { $set: { state: 'queued', error: reason, nextAttemptAt: new Date(Date.now() + job.attempts * 60000) }, $unset: { leaseToken: 1, leaseUntil: 1 } });
    } else await finish(job, leaseToken, null, reason);
    return { processed: true, reason };
  }
}
export async function recoverCollabJobs() {
  await connectToDatabase();
  const now = new Date();
  const exhausted = await Job.find({ state: 'running', leaseUntil: { $lte: now }, attempts: { $gte: 3 } }).limit(20).lean();
  for (const job of exhausted) await finish(job, job.leaseToken!, null, 'attempts_exhausted');
  const jobs = await Job.find({ nextAttemptAt: { $lte: now }, $or: [{ state: 'queued' }, { state: 'running', leaseUntil: { $lte: now } }] }).sort({ nextAttemptAt: 1 }).limit(30).select('_id').lean();
  let published = 0;
  for (const job of jobs) if (await publishJob(String(job._id))) published++;
  return { pending: jobs.length, published };
}
