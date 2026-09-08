/** @jest-environment node */
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createHash } from 'node:crypto';
import Job from '@/app/models/VideoAnalysisJob';
import User from '@/app/models/User';
import { registerUpload, requestVideoAnalysis, readVideoAnalysis, cancelVideoUpload, processVideoAnalysis, recoverVideoAnalyses } from './jobs';
import { executeVideoAnalysis } from './execute';
import { runVideoNarrativeGeminiProvider } from '@/app/dashboard/boards/videoUpload/videoNarrativeGeminiProvider';
import { deleteVideoNarrativeTemporaryStorageObject } from '@/app/dashboard/boards/videoUpload/videoNarrativeTemporaryStorageRuntimeAdapter';
jest.mock('@/app/lib/mongoose', () => ({ connectToDatabase: jest.fn() }));
jest.mock('@upstash/qstash', () => ({ Client: jest.fn(() => ({ publishJSON: jest.fn().mockResolvedValue({}) })) }));
jest.mock('./execute', () => ({ executeVideoAnalysis: jest.fn() }));
jest.mock('@/app/dashboard/boards/videoUpload/videoNarrativeGeminiProvider', () => ({ runVideoNarrativeGeminiProvider: jest.fn() }));
jest.mock('@/app/dashboard/boards/videoUpload/geminiVideoNarrativeClientFactory', () => ({ createVideoNarrativeGeminiClientAdapter: () => ({ client: {} }) }));
jest.mock('@/app/dashboard/boards/videoUpload/videoNarrativeTemporaryStorageRuntimeAdapter', () => ({ deleteVideoNarrativeTemporaryStorageObject: jest.fn().mockResolvedValue(true) }));
let db: MongoMemoryServer;
let owner: string;
async function upload(suffix = 'one') {
  const id = `video-temp-upload-session-${suffix}`;
  const objectKey = `temporary/video-narrative/${createHash('sha256').update(owner).digest('hex').slice(0, 16)}/${id}.mp4`;
  await registerUpload(owner, { id, objectKey, expiresAt: new Date(Date.now() + 60000).toISOString() }, 'video/mp4', 1000);
  return { uploadSessionId: id, temporaryUpload: { objectKey, mimeType: 'video/mp4', sizeBytes: 1000 }, creatorGoal: 'Analisar meu vídeo', selectedGoalOption: 'retention', consentTextVersion: 'v1' };
}
beforeAll(async () => {
  db = await MongoMemoryServer.create({ binary: { downloadDir: '/private/tmp/collabs-mongodb' } });
  await mongoose.connect(db.getUri('video_audit_test'), { autoIndex: false });
  await Job.createIndexes();
}, 180000);
afterAll(async () => { await mongoose.disconnect(); await db?.stop(); });
beforeEach(async () => {
  jest.clearAllMocks();
  await Job.deleteMany({}); await User.deleteMany({});
  owner = new Types.ObjectId().toString();
  await User.collection.insertOne({ _id: new Types.ObjectId(owner), name: 'Teste', role: 'admin' });
});
it('duas sessões concorrentes reservam somente uma análise para o usuário', async () => {
  const first = await upload(), second = await upload('two');
  const results = await Promise.all([requestVideoAnalysis(owner, first), requestVideoAnalysis(owner, second)]);
  expect(results.map(r => r.status).sort()).toEqual([202, 409]);
  expect(await Job.countDocuments({ activeKey: owner })).toBe(1);
});
it('repetição da mesma sessão converge para o mesmo trabalho', async () => {
  const body = await upload();
  const results = await Promise.all([requestVideoAnalysis(owner, body), requestVideoAnalysis(owner, body)]);
  expect(results.every(r => r.status === 202)).toBe(true);
  expect(await Job.countDocuments({ state: 'queued' })).toBe(1);
});
it('outra pessoa não consulta, analisa ou apaga o vídeo', async () => {
  const body = await upload(), other = new Types.ObjectId().toString();
  expect((await requestVideoAnalysis(other, body)).status).toBe(403);
  expect(await readVideoAnalysis(other, body.uploadSessionId)).toBeNull();
  expect(await cancelVideoUpload(other, body.uploadSessionId, body.temporaryUpload.objectKey)).toBe(false);
  expect(deleteVideoNarrativeTemporaryStorageObject).not.toHaveBeenCalled();
});
it('fechar uma análise aceita não exclui o arquivo em uso', async () => {
  const body = await upload(); await requestVideoAnalysis(owner, body);
  await cancelVideoUpload(owner, body.uploadSessionId, body.temporaryUpload.objectKey);
  expect(deleteVideoNarrativeTemporaryStorageObject).not.toHaveBeenCalled();
  expect((await Job.findById(body.uploadSessionId))?.state).toBe('queued');
});
it('falha de gravação reaproveita o checkpoint sem outra chamada à IA', async () => {
  const body = await upload(); await requestVideoAnalysis(owner, body);
  (runVideoNarrativeGeminiProvider as jest.Mock).mockResolvedValue({ ok: true, analysis: { validated: true } });
  let attempts = 0;
  (executeVideoAnalysis as jest.Mock).mockImplementation(async (_request, _session, execution) => {
    await execution.runProvider({ config: { apiKey: 'test' }, input: { temporaryUpload: { mimeType: 'video/mp4', sizeBytes: 1000 } }, videoInput: { durationSeconds: 10 } }); attempts++;
    return Response.json(attempts === 1 ? { message: 'Falha ao salvar' } : { ok: true, videoReadingPersistence: { saved: true, diagnosisId: 'test' } }, { status: attempts === 1 ? 502 : 200 });
  });
  await processVideoAnalysis(body.uploadSessionId);
  expect((await Job.findById(body.uploadSessionId))?.state).toBe('queued');
  await processVideoAnalysis(body.uploadSessionId);
  expect(runVideoNarrativeGeminiProvider).toHaveBeenCalledTimes(1);
  expect((await readVideoAnalysis(owner, body.uploadSessionId))?.state).toBe('completed');
  expect((await Job.findById(body.uploadSessionId))?.activeKey).toBeUndefined();
});
it('dois trabalhadores não processam o mesmo vídeo ao mesmo tempo', async () => {
  const body = await upload(); await requestVideoAnalysis(owner, body);
  (executeVideoAnalysis as jest.Mock).mockResolvedValue(Response.json({ ok: true }));
  const results = await Promise.all([processVideoAnalysis(body.uploadSessionId), processVideoAnalysis(body.uploadSessionId)]);
  expect(results.filter(r => r.processed)).toHaveLength(1);
  expect(executeVideoAnalysis).toHaveBeenCalledTimes(1);
});
it('trabalho interrompido sem checkpoint encerra sem repetir a chamada paga', async () => {
  const body = await upload(); await requestVideoAnalysis(owner, body);
  await Job.updateOne({ _id: body.uploadSessionId }, { $set: { state: 'running', leaseToken: 'old', leaseUntil: new Date(0), attempts: 1 } });
  await recoverVideoAnalyses();
  expect((await Job.findById(body.uploadSessionId))?.state).toBe('failed');
  expect(runVideoNarrativeGeminiProvider).not.toHaveBeenCalled();
});
