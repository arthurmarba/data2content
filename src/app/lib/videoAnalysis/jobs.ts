import { randomUUID } from 'node:crypto';
import { Client } from '@upstash/qstash';
import Job, { type VideoAnalysisJobRecord } from '@/app/models/VideoAnalysisJob';
import User from '@/app/models/User';
import Diagnosis from '@/app/models/CreatorVideoNarrativeDiagnosis';
import { connectToDatabase } from '@/app/lib/mongoose';
import { ownsVideoUpload } from './ownership';
import { validateVideoNarrativeRealAnalysisPayload } from '@/app/dashboard/boards/videoUpload/videoNarrativeRealAnalysisTypes';
import { deleteVideoNarrativeTemporaryStorageObject } from '@/app/dashboard/boards/videoUpload/videoNarrativeTemporaryStorageRuntimeAdapter';

const ACTIVE = ['queued', 'running'];
const MAX_ATTEMPTS = 3;
let indexes: Promise<unknown> | undefined;
async function ensureIndexes() {
  indexes ??= Job.createIndexes().catch(error => { indexes = undefined; throw error; });
  await indexes;
}
export async function registerUpload(userId: string, upload: { id: string; objectKey?: string; expiresAt: string }, mimeType: string, sizeBytes: number) {
  if (!ownsVideoUpload(userId, upload.id, upload.objectKey)) throw new Error('Sessão de vídeo inválida.');
  await connectToDatabase();
  await ensureIndexes(); // Garante a restrição de concorrência antes de aceitar trabalhos.
  await Job.create({ _id: upload.id, userId, objectKey: upload.objectKey, mimeType, sizeBytes, signedUntil: new Date(upload.expiresAt), expiresAt: new Date(Date.now() + 24 * 3600000), state: 'uploading' });
}
export async function publishVideoAnalysis(id: string) {
  const token = process.env.QSTASH_TOKEN;
  const base = (process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || '').replace(/\/$/, '');
  if (!token || !base.startsWith('https://')) return false;
  try {
    await new Client({ token }).publishJSON({ url: `${base}/api/worker/analyze-uploaded-video`, body: { jobId: id }, retries: 2, deduplicationId: `video:${id}:${Math.floor(Date.now() / 60000)}` });
    return true;
  } catch { return false; }
}
export function publicVideoJob(job: VideoAnalysisJobRecord) {
  return { jobId: job._id, state: job.state, stage: job.state === 'running' ? (job.checkpoint ? 'saving' : 'analyzing') : job.state, ...(job.state === 'completed' || job.state === 'failed' ? { result: job.result, httpStatus: job.httpStatus } : {}), requestId: job._id };
}
export async function requestVideoAnalysis(userId: string, body: unknown) {
  const validation = validateVideoNarrativeRealAnalysisPayload(body);
  if (!validation.ok) return { status: 400, data: { ok: false, code: validation.code, message: validation.message, retryable: false } };
  const payload = validation.payload;
  if (!ownsVideoUpload(userId, payload.uploadSessionId, payload.temporaryUpload?.objectKey)) return { status: 403, data: { message: 'Este vídeo não pertence à sua sessão.', retryable: false } };
  await connectToDatabase();
  await ensureIndexes();
  let job = await Job.findOne({ _id: payload.uploadSessionId, userId }).lean();
  if (!job || job.objectKey !== payload.temporaryUpload?.objectKey) return { status: 404, data: { message: 'Sessão de envio não encontrada. Envie o vídeo novamente.', retryable: false } };
  if (job.state === 'cancelled' || job.expiresAt.getTime() <= Date.now()) return { status: 410, data: { message: 'A sessão de envio expirou. Envie o vídeo novamente.', retryable: false } };
  if (job.state === 'uploading') {
    try {
      job = await Job.findOneAndUpdate({ _id: job._id, userId, state: 'uploading' }, { $set: { state: 'queued', activeKey: userId, payload: { ...payload, persistReading: true, persistSynthesisSnapshot: false, temporaryUpload: { ...payload.temporaryUpload, objectKey: job.objectKey, mimeType: job.mimeType, sizeBytes: job.sizeBytes } } } }, { new: true }).lean()
        || await Job.findOne({ _id: job._id, userId }).lean();
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      return { status: 409, data: { message: 'Você já tem uma análise em andamento. Feche e abra o botão + para acompanhá-la.', retryable: false } };
    }
  }
  if (!job) throw new Error('Sessão não encontrada.');
  if (job.state === 'queued') await publishVideoAnalysis(job._id);
  return { status: 202, data: publicVideoJob(job) };
}
export async function readVideoAnalysis(userId: string, id?: string | null) {
  await connectToDatabase();
  const job = await Job.findOne(id ? { _id: id, userId } : { userId, acknowledged: false, state: { $in: [...ACTIVE, 'completed', 'failed'] }, expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 }).lean();
  return job ? publicVideoJob(job) : null;
}
export async function acknowledgeVideoAnalysis(userId: string, id: string) {
  await connectToDatabase();
  await Job.updateOne({ _id: id, userId, state: { $in: ['completed', 'failed'] } }, { $set: { acknowledged: true } });
}
export async function cancelVideoUpload(userId: string, id: string, objectKey?: string) {
  if (!ownsVideoUpload(userId, id, objectKey)) return false;
  await connectToDatabase();
  // A análise aceita pertence ao trabalhador; fechar a tela não a destrói.
  const job = await Job.findOneAndUpdate({ _id: id, userId, state: 'uploading' }, { $set: { state: 'cancelled', acknowledged: true } }, { new: true }).lean();
  if (job) await deleteVideoNarrativeTemporaryStorageObject({ objectKey: job.objectKey }).catch(() => false);
  // Uma segunda limpeza após expirar a URL cobre PUTs que terminaram após o cancelamento.
  return true;
}
async function completeJob(job: VideoAnalysisJobRecord, token: string, data: Record<string, any>, status: number) {
  await Job.updateOne({ _id: job._id, state: 'running', leaseToken: token }, { $set: { state: status < 400 ? 'completed' : 'failed', result: data, httpStatus: status }, $unset: { activeKey: 1, leaseToken: 1, leaseUntil: 1, checkpoint: 1, payload: 1 } });
}
export async function processVideoAnalysis(id: string) {
  await connectToDatabase();
  const token = randomUUID();
  const job = await Job.findOneAndUpdate({ _id: id, state: 'queued', attempts: { $lt: MAX_ATTEMPTS } }, { $set: { state: 'running', leaseToken: token, leaseUntil: new Date(Date.now() + 360000) }, $inc: { attempts: 1 } }, { new: true }).lean();
  if (!job) return { processed: false };
  try {
    // Recupera um salvamento concluído antes de uma queda, sem chamar o provedor.
    const diagnosisId = `video-narrative-diagnosis-real-video-narrative-${job._id}`;
    const saved = await Diagnosis.exists({ userId: job.userId, diagnosisId, status: 'completed' });
    if (saved) {
      await completeJob(job, token, { ok: true, videoReadingPersistence: { saved: true, diagnosisId }, requestId: job._id }, 200);
      return { processed: true };
    }
    const user = await User.findById(job.userId).select('email name role planStatus instagramConnected isInstagramConnected').lean();
    if (!user) throw new Error('user_unavailable');
    const { executeVideoAnalysis } = await import('./execute');
    const { runVideoNarrativeGeminiProvider } = await import('@/app/dashboard/boards/videoUpload/videoNarrativeGeminiProvider');
    const { createVideoNarrativeGeminiClientAdapter } = await import('@/app/dashboard/boards/videoUpload/geminiVideoNarrativeClientFactory');
    const response = await executeVideoAnalysis(new Request('https://internal/video-analysis', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(job.payload) }), { user: { ...user, id: job.userId } } as any, {
      requestId: id,
      resumeMedia: job.checkpoint?._media,
      runProvider: async params => {
        if (job.checkpoint) return job.checkpoint as any;
        const client = createVideoNarrativeGeminiClientAdapter({ apiKey: params.config?.apiKey || '', model: params.config?.model || undefined, openAiFallbackApiKey: process.env.OPENAI_API_KEY?.trim(), openAiFallbackModel: process.env.VIDEO_NARRATIVE_OPENAI_FALLBACK_MODEL?.trim(), openAiFallbackEnabled: process.env.VIDEO_NARRATIVE_OPENAI_FALLBACK_ENABLED !== "false" && Boolean(process.env.OPENAI_API_KEY?.trim()) }).client;
        const result = await runVideoNarrativeGeminiProvider({ ...params, client });
        if (result.ok) {
          const checkpoint = { ...result, _media: { mimeType: params.input.temporaryUpload?.mimeType, sizeBytes: params.input.temporaryUpload?.sizeBytes, durationSeconds: params.videoInput?.durationSeconds, earlyVisualChanges: params.input.temporaryUpload?.earlyVisualChanges } };
          const committed = await Job.updateOne({ _id: id, state: 'running', leaseToken: token }, { $set: { checkpoint } });
          if (!committed.modifiedCount) throw new Error('lease_lost');
          job.checkpoint = checkpoint as any;
        }
        return result;
      },
    });
    const data = await response.json();
    if (response.status >= 500 && job.checkpoint && job.attempts < MAX_ATTEMPTS) {
      await Job.updateOne({ _id: id, leaseToken: token }, { $set: { state: 'queued' }, $unset: { leaseToken: 1, leaseUntil: 1 } });
      await publishVideoAnalysis(id);
    } else {
      await completeJob(job, token, { ...data, requestId: id, retryable: false }, response.status);
    }
  } catch {
    // Resultado ambíguo antes do checkpoint não autoriza outra chamada paga.
    if (job.checkpoint && job.attempts < MAX_ATTEMPTS) {
      await Job.updateOne({ _id: id, leaseToken: token }, { $set: { state: 'queued' }, $unset: { leaseToken: 1, leaseUntil: 1 } });
    } else await completeJob(job, token, { ok: false, message: 'A análise foi interrompida. Consulte suas últimas análises antes de enviar novamente.', code: 'analysis_interrupted', retryable: false, requestId: id }, 502);
  }
  return { processed: true };
}
export async function recoverVideoAnalyses() {
  await connectToDatabase();
  const now = new Date();
  const expired = await Job.find({ state: 'running', leaseUntil: { $lte: now } }).limit(30).lean();
  for (const job of expired) {
    if (job.checkpoint && job.attempts < MAX_ATTEMPTS) await Job.updateOne({ _id: job._id, leaseToken: job.leaseToken }, { $set: { state: 'queued' }, $unset: { leaseToken: 1, leaseUntil: 1 } });
    else {
      const diagnosisId = `video-narrative-diagnosis-real-video-narrative-${job._id}`;
      const saved = await Diagnosis.exists({ userId: job.userId, diagnosisId, status: 'completed' });
      await completeJob(job, job.leaseToken!, saved ? { ok: true, videoReadingPersistence: { saved: true, diagnosisId } } : { message: 'A análise foi interrompida. Você pode consultar suas últimas análises e enviar novamente.', retryable: false, requestId: job._id }, saved ? 200 : 502);
    }
  }
  const queued = await Job.find({ state: 'queued' }).sort({ createdAt: 1 }).limit(30).lean();
  for (const job of queued) {
    if (job.expiresAt <= now) await Job.updateOne({ _id: job._id, state: 'queued' }, { $set: { state: 'failed', result: { message: 'O envio expirou antes da análise. Envie novamente.', retryable: false }, httpStatus: 410 }, $unset: { activeKey: 1, payload: 1, checkpoint: 1 } });
    else await publishVideoAnalysis(job._id);
  }
  const discarded = await Job.find({ cleanedAt: null, signedUntil: { $lt: new Date(Date.now() - 600000) }, $or: [{ state: { $in: ['completed', 'failed', 'cancelled'] } }, { state: 'uploading', expiresAt: { $lt: now } }] }).limit(50).lean();
  await Promise.allSettled(discarded.map(async job => {
    if (await deleteVideoNarrativeTemporaryStorageObject({ objectKey: job.objectKey }).catch(() => false)) await Job.updateOne({ _id: job._id }, { $set: { cleanedAt: now }, $unset: { checkpoint: 1, payload: 1 } });
  }));
  await Job.deleteMany({ cleanedAt: { $exists: true }, state: { $nin: ACTIVE }, updatedAt: { $lt: new Date(Date.now() - 7 * 86400000) } });
  return { recovered: expired.length, queued: queued.length, cleanup: discarded.length };
}
