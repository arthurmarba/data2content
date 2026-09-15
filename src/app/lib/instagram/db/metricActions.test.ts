/** @jest-environment node */
import { Types } from 'mongoose';
import { saveMetricData } from './metricActions';
import Metric from '@/app/models/Metric';
import { enqueuePublishedReading } from '@/app/lib/creatorWeeklyReport/queue';

jest.mock('@/app/lib/creatorWeeklyReport/queue', () => ({ enqueuePublishedReading: jest.fn().mockResolvedValue(true) }));
jest.mock('@/app/lib/mongoose', () => ({ connectToDatabase: jest.fn() }));
jest.mock('@/app/lib/logger', () => ({ logger: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('@/app/lib/classificationRuntime', () => ({ createEmptyMetricClassificationUpdate: () => ({}) }));
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
