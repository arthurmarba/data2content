/** @jest-environment node */
import { Types } from 'mongoose';
import { saveMetricData } from './metricActions';
import Metric from '@/app/models/Metric';
import { enqueuePublishedReading } from '@/app/lib/creatorWeeklyReport/queue';

jest.mock('@/app/lib/creatorWeeklyReport/queue', () => ({ enqueuePublishedReading: jest.fn().mockResolvedValue(true) }));
jest.mock('@/app/lib/mongoose', () => ({ connectToDatabase: jest.fn() }));
jest.mock('@/app/lib/logger', () => ({ logger: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('@/app/lib/classificationRuntime', () => ({ createEmptyMetricClassificationUpdate: () => ({ format: [], proposal: [] }) }));
jest.mock('@/app/models/Metric', () => ({ __esModule: true, default: { findOneAndUpdate: jest.fn() } }));
jest.mock('@upstash/qstash', () => ({ Client: jest.fn().mockImplementation(() => ({ publishJSON: jest.fn() })) }));

beforeEach(() => jest.clearAllMocks());
it.each(['IMAGE', 'CAROUSEL_ALBUM'] as const)('post %s sem legenda dispara leitura ao sincronizar', async (media_type) => {
  const id = new Types.ObjectId();
  (Metric.findOneAndUpdate as jest.Mock).mockImplementation(async (_filter, update) => ({
    _id: id, ...update.$set, ...update.$setOnInsert,
  }));
  await saveMetricData(new Types.ObjectId(), { id: 'instagram', media_type, timestamp: new Date(Date.now() - 40 * 86400000).toISOString() }, {} as any);
  expect(enqueuePublishedReading).toHaveBeenCalledWith(String(id));
});
it('classificação pendente continua a disparar leitura pelo worker de texto', async () => {
  (Metric.findOneAndUpdate as jest.Mock).mockResolvedValue({ _id: new Types.ObjectId(), classificationStatus: 'pending', description: 'legenda' });
  await saveMetricData(new Types.ObjectId(), { id: 'instagram', media_type: 'IMAGE', caption: 'legenda', timestamp: new Date().toISOString() }, {} as any);
  expect(enqueuePublishedReading).not.toHaveBeenCalled();
});
it('histórico antigo puxado sem IA não dispara leitura nenhuma', async () => {
  const id = new Types.ObjectId();
  (Metric.findOneAndUpdate as jest.Mock).mockImplementation(async (_filter, update) => ({
    _id: id, ...update.$set, ...update.$setOnInsert,
  }));
  await saveMetricData(
    new Types.ObjectId(),
    { id: 'instagram', media_type: 'IMAGE', timestamp: new Date(Date.now() - 400 * 86400000).toISOString() },
    {} as any,
    { skipAiReadings: true },
  );
  expect(enqueuePublishedReading).not.toHaveBeenCalled();
});
it('Reel grava a retenção juntando o tempo médio dos insights com a duração da mídia', async () => {
  (Metric.findOneAndUpdate as jest.Mock).mockImplementation(async (_filter, update) => ({
    _id: new Types.ObjectId(), ...update.$set, ...update.$setOnInsert,
  }));
  await saveMetricData(
    new Types.ObjectId(),
    { id: 'reel', media_type: 'VIDEO', media_product_type: 'REELS', video_duration: 40, timestamp: new Date(Date.now() - 40 * 86400000).toISOString() } as any,
    { ig_reels_avg_watch_time: 10_000, reach: 100 } as any,
  );
  const update = (Metric.findOneAndUpdate as jest.Mock).mock.calls[0][1];
  expect(update.$set['stats.video_duration_seconds']).toBe(40);
  expect(update.$set['stats.retention_rate']).toBe(0.25);
});
it('Reel sem tempo médio não ganha retenção zero', async () => {
  (Metric.findOneAndUpdate as jest.Mock).mockImplementation(async (_filter, update) => ({
    _id: new Types.ObjectId(), ...update.$set, ...update.$setOnInsert,
  }));
  await saveMetricData(
    new Types.ObjectId(),
    { id: 'reel', media_type: 'VIDEO', media_product_type: 'REELS', video_duration: 40, timestamp: new Date(Date.now() - 40 * 86400000).toISOString() } as any,
    { reach: 100 } as any,
  );
  const update = (Metric.findOneAndUpdate as jest.Mock).mock.calls[0][1];
  expect(update.$set).not.toHaveProperty(['stats.retention_rate']);
});
it('histórico antigo não guarda os links de mídia, que expiram em dias', async () => {
  (Metric.findOneAndUpdate as jest.Mock).mockImplementation(async (_filter, update) => ({
    _id: new Types.ObjectId(), ...update.$set, ...update.$setOnInsert,
  }));
  await saveMetricData(
    new Types.ObjectId(),
    { id: 'antigo', media_type: 'IMAGE', media_url: 'https://cdn/x.jpg', timestamp: new Date(Date.now() - 400 * 86400000).toISOString() } as any,
    { reach: 10 } as any,
    { skipAiReadings: true, skipMediaUrls: true },
  );
  const update = (Metric.findOneAndUpdate as jest.Mock).mock.calls[0][1];
  expect(update.$set).not.toHaveProperty('mediaUrl');
  expect(update.$set).not.toHaveProperty('coverUrl');
  expect(update.$set).not.toHaveProperty('thumbnailUrl');
});
it('post sem legenda não escreve format em $set e $setOnInsert ao mesmo tempo', async () => {
  (Metric.findOneAndUpdate as jest.Mock).mockImplementation(async (_filter, update) => ({
    _id: new Types.ObjectId(), ...update.$set, ...update.$setOnInsert,
  }));
  await saveMetricData(new Types.ObjectId(), { id: 'sem-legenda', media_type: 'IMAGE', timestamp: new Date(Date.now() - 400 * 86400000).toISOString() } as any, {} as any);
  const update = (Metric.findOneAndUpdate as jest.Mock).mock.calls[0][1];
  expect(update.$set).toHaveProperty('format');
  expect(update.$setOnInsert).not.toHaveProperty('format');
  expect(update.$setOnInsert).toHaveProperty('proposal');
});
