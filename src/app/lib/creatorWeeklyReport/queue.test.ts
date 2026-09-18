/** @jest-environment node */
import Evidence from '@/app/models/PublishedContentEvidence';
import { VISUAL_READING_REVISION } from '@/app/lib/relatorio/readingRevision';
import { enqueuePublishedReading, enqueueProfileRefresh, enqueueOnboardingReadings } from './queue';
jest.mock('@/app/models/PublishedContentEvidence', () => ({ __esModule: true, default: { exists: jest.fn() } }));
const mockPublish = jest.fn();
const mockMetric = jest.fn();
const mockUser = jest.fn();
const mockProvider = jest.fn();
jest.mock('@upstash/qstash', () => ({ Client: jest.fn().mockImplementation(() => ({ publishJSON: mockPublish })) }));
jest.mock('@/app/lib/mongoose', () => ({ connectToDatabase: jest.fn() }));
jest.mock('@/app/lib/logger', () => ({ logger: { warn: jest.fn() } }));
const mockRecentes = jest.fn();
jest.mock('@/app/models/Metric', () => ({ __esModule: true, default: {
  findById: () => ({ select: () => ({ lean: () => mockMetric() }) }),
  find: () => ({ sort: () => ({ limit: (n: number) => ({ select: () => ({ lean: () => mockRecentes(n) }) }) }) }),
} }));
jest.mock('@/app/models/User', () => ({ __esModule: true, default: { findById: () => ({ select: () => ({ lean: () => mockUser() }) }) } }));
jest.mock('@/app/models/ContentReadingState', () => ({ __esModule: true, default: { findById: () => ({ select: () => ({ lean: () => mockProvider() }) }) } }));
const id = '69e8f96564be9f1592a5ca6e';
const previousEnv = { token: process.env.QSTASH_TOKEN, base: process.env.APP_BASE_URL };
beforeEach(() => {
  jest.clearAllMocks(); jest.useFakeTimers().setSystemTime(new Date('2026-09-08T12:00:00Z'));
  process.env.QSTASH_TOKEN = 'teste'; process.env.APP_BASE_URL = 'https://example.test';
  mockMetric.mockResolvedValue({ user: id, instagramMediaId: 'post', type: 'REEL', postDate: new Date() });
  mockUser.mockResolvedValue({ isInstagramConnected: true, planStatus: 'active' });
  mockProvider.mockResolvedValue(null); mockPublish.mockResolvedValue({});
});
afterEach(() => { jest.useRealTimers(); if (previousEnv.token === undefined) delete process.env.QSTASH_TOKEN; else process.env.QSTASH_TOKEN = previousEnv.token; if (previousEnv.base === undefined) delete process.env.APP_BASE_URL; else process.env.APP_BASE_URL = previousEnv.base; });

it('liga a classificação concluída à leitura e agrupa eventos do perfil', async () => {
  expect(await enqueuePublishedReading(id)).toBe(true);
  expect(mockPublish.mock.calls[0][0].url).toContain('/classify-published-scene');
  await enqueueProfileRefresh(id); await enqueueProfileRefresh(id);
  expect(mockPublish.mock.calls[1][0].deduplicationId).toBe(mockPublish.mock.calls[2][0].deduplicationId);
});
it('na conexão nova, lê os 30 posts mais recentes e ignora quem já tem leitura', async () => {
  mockRecentes.mockImplementation(async (limite: number) => {
    expect(limite).toBe(30);
    return [{ _id: id }, { _id: id }];
  });
  (Evidence.exists as jest.Mock).mockResolvedValueOnce({ _id: id });
  mockMetric.mockResolvedValueOnce({ user: id, instagramMediaId: 'post', type: 'IMAGE', postDate: new Date(), sceneElements: { version: VISUAL_READING_REVISION } });
  mockMetric.mockResolvedValue({ user: id, instagramMediaId: 'post', type: 'REEL', postDate: new Date() });
  expect(await enqueueOnboardingReadings(id)).toBe(1);
  expect(mockPublish).toHaveBeenCalledTimes(1);
});
it('respeita indisponibilidade do provedor e acesso da conta', async () => {
  mockProvider.mockResolvedValue({ state: 'paused', nextAttemptAt: new Date(Date.now() + 3600000) });
  expect(await enqueuePublishedReading(id)).toBe(false);
  mockProvider.mockResolvedValue(null); mockUser.mockResolvedValue({ isInstagramConnected: true, planStatus: 'inactive' });
  expect(await enqueuePublishedReading(id)).toBe(false);
  expect(mockPublish).not.toHaveBeenCalled();
});
it('falha de fila não transforma uma evidência já salva em erro de análise', async () => {
  mockPublish.mockRejectedValue(new Error('Fila indisponível'));
  expect(await enqueuePublishedReading(id)).toBe(false);
});

it.each(['IMAGE', 'CAROUSEL_ALBUM'])('encaminha %s sem depender de legenda', async (type) => {
  mockMetric.mockResolvedValue({ user: id, instagramMediaId: 'post', type, postDate: new Date() });
  expect(await enqueuePublishedReading(id)).toBe(true);
});
it('sincronização não reenfileira leitura completa, mas recupera evidência ausente', async () => {
  mockMetric.mockResolvedValue({ user: id, instagramMediaId: 'post', type: 'IMAGE', postDate: new Date(), sceneElements: { version: VISUAL_READING_REVISION } });
  (Evidence.exists as jest.Mock).mockResolvedValue({ _id: id });
  expect(await enqueuePublishedReading(id)).toBe(false);
  expect(mockPublish).not.toHaveBeenCalled();
  (Evidence.exists as jest.Mock).mockResolvedValue(null);
  expect(await enqueuePublishedReading(id)).toBe(true);
});
