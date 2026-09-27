/** @jest-environment node */
import { Types } from 'mongoose';
import Metric from '@/app/models/Metric';

const mockPublishJSON = jest.fn();
jest.mock('@upstash/qstash', () => ({ Client: jest.fn().mockImplementation(() => ({ publishJSON: mockPublishJSON })) }));
jest.mock('@/app/lib/creatorWeeklyReport/queue', () => ({ enqueuePublishedReading: jest.fn().mockResolvedValue(true) }));
jest.mock('@/app/lib/mongoose', () => ({ connectToDatabase: jest.fn() }));
jest.mock('@/app/lib/logger', () => ({ logger: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('@/app/lib/classificationRuntime', () => ({ createEmptyMetricClassificationUpdate: () => ({}) }));
jest.mock('@/app/models/Metric', () => ({ __esModule: true, default: { findOneAndUpdate: jest.fn(), updateOne: jest.fn() } }));
jest.mock('@/app/models/DailyMetricSnapshot', () => ({ __esModule: true, default: { findOne: jest.fn(), updateOne: jest.fn() } }));

// O cliente da QStash nasce na carga do módulo: as variáveis precisam existir antes.
process.env.QSTASH_TOKEN = 'token-de-teste';
process.env.CLASSIFICATION_WORKER_URL = 'https://app.test/api/worker/classify-content';
delete process.env.INTELLIGENCE_RECOVERY_REQUEUE_HOURS;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { saveMetricData } = require('./metricActions') as typeof import('./metricActions');

const HOUR = 60 * 60 * 1000;
const DEFERRED = 'Classificação adiada: saldo/quota da IA indisponível. Reprocesse quando o saldo for restabelecido.';

function syncPost(saved: Record<string, unknown>) {
  const id = new Types.ObjectId();
  (Metric.findOneAndUpdate as jest.Mock).mockResolvedValue({ _id: id, description: 'legenda', ...saved });
  return {
    id,
    run: () => saveMetricData(new Types.ObjectId(), {
      id: `ig-${id}`, media_type: 'IMAGE', caption: 'legenda', timestamp: new Date().toISOString(),
    }, {} as any),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPublishJSON.mockResolvedValue({ messageId: 'msg' });
  (Metric.updateOne as jest.Mock).mockResolvedValue({ acknowledged: true });
});

describe('saveMetricData — envio para a classificação', () => {
  it('post novo vai na hora, com deduplicação por post+hora, e marca o envio', async () => {
    const post = syncPost({ classificationStatus: 'pending', classificationError: null, classificationLastQueuedAt: null });
    await post.run();

    expect(mockPublishJSON).toHaveBeenCalledTimes(1);
    expect(mockPublishJSON).toHaveBeenCalledWith({
      url: 'https://app.test/api/worker/classify-content',
      body: { metricId: String(post.id) },
      retries: 2,
      deduplicationId: expect.stringMatching(new RegExp(`^classification-sync-${post.id}-\\d{4}-\\d{2}-\\d{2}T\\d{2}$`)),
    });
    expect(Metric.updateOne).toHaveBeenCalledWith(
      { _id: post.id, classificationStatus: 'pending' },
      { $set: { classificationLastQueuedAt: expect.any(Date) } },
    );
  });

  it('post adiado por falta de saldo não volta para a fila a cada sincronização', async () => {
    const post = syncPost({
      classificationStatus: 'pending', classificationError: DEFERRED,
      classificationLastQueuedAt: new Date(Date.now() - 3 * 24 * HOUR),
    });
    await post.run();
    await post.run();

    expect(mockPublishJSON).not.toHaveBeenCalled();
    expect(Metric.updateOne).not.toHaveBeenCalled();
  });

  it('post enviado há menos de seis horas não é reenviado', async () => {
    const post = syncPost({ classificationStatus: 'pending', classificationError: null, classificationLastQueuedAt: new Date(Date.now() - HOUR) });
    await post.run();
    expect(mockPublishJSON).not.toHaveBeenCalled();
  });

  it('post pendente sem erro gravado e enviado há mais de seis horas volta para a fila', async () => {
    const post = syncPost({ classificationStatus: 'pending', classificationError: null, classificationLastQueuedAt: new Date(Date.now() - 7 * HOUR) });
    await post.run();
    expect(mockPublishJSON).toHaveBeenCalledTimes(1);
  });

  it('falha na QStash não marca o envio nem derruba a sincronização', async () => {
    mockPublishJSON.mockRejectedValueOnce(new Error('QStash fora'));
    const post = syncPost({ classificationStatus: 'pending', classificationError: null, classificationLastQueuedAt: null });
    await expect(post.run()).resolves.toBeUndefined();
    expect(Metric.updateOne).not.toHaveBeenCalled();
  });
});
