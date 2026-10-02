/** @jest-environment node */
import { Types } from 'mongoose';
import {
  afterCursorFromNextPageUrl,
  instagramDayFromEndTime,
  isInstagramRateLimitError,
  needsHistoryBackfill,
  runInstagramHistoryBackfillStep,
} from './historyBackfill';
import { fetchDailyNewFollowers, fetchInstagramMedia, fetchMediaInsights } from '../api/fetchers';
import { saveMetricData } from '../db/metricActions';
import DbUser from '@/app/models/User';
import MetricModel from '@/app/models/Metric';
import InstagramNewFollowersDayModel from '@/app/models/InstagramNewFollowersDay';

jest.mock('@/app/lib/mongoose', () => ({ connectToDatabase: jest.fn() }));
jest.mock('@/app/lib/logger', () => ({ logger: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('../api/fetchers', () => ({
  fetchDailyNewFollowers: jest.fn(),
  fetchInstagramMedia: jest.fn(),
  fetchMediaInsights: jest.fn(),
}));
jest.mock('../db/metricActions', () => ({ saveMetricData: jest.fn() }));
jest.mock('../utils/videoDurationFromUrl', () => ({ probeVideoDurationSecondsFromUrl: jest.fn(async () => 42) }));
jest.mock('@/app/models/User', () => ({ __esModule: true, default: { findById: jest.fn(), updateOne: jest.fn() } }));
jest.mock('@/app/models/Metric', () => ({ __esModule: true, default: { find: jest.fn() } }));
jest.mock('@/app/models/InstagramNewFollowersDay', () => ({ __esModule: true, default: { bulkWrite: jest.fn() } }));

const now = new Date('2026-10-02T12:00:00Z');
const userId = new Types.ObjectId().toString();
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
const chain = (value: unknown) => ({ select: () => ({ lean: async () => value }) });

beforeEach(() => {
  jest.clearAllMocks();
  (DbUser.findById as jest.Mock).mockReturnValue(chain({
    isInstagramConnected: true, instagramAccountId: 'conta', instagramAccessToken: 'token',
  }));
  (fetchDailyNewFollowers as jest.Mock).mockResolvedValue({ success: true, data: [
    { endTime: new Date('2026-09-29T07:00:00Z'), newFollowers: 254 },
  ] });
  (fetchMediaInsights as jest.Mock).mockResolvedValue({ success: true, data: { reach: 1000, ig_reels_avg_watch_time: 5000 } });
});

it('reconhece o limite de chamadas do Instagram', () => {
  expect(isInstagramRateLimitError('Falha na requisição (Erro 400): (#4) Application request limit reached')).toBe(true);
  expect(isInstagramRateLimitError('(#100) Invalid parameter')).toBe(false);
});

it('guarda só o cursor da próxima página, nunca a URL com o token', () => {
  expect(afterCursorFromNextPageUrl('https://graph.facebook.com/v22.0/1/media?access_token=segredo&after=QVFI')).toBe('QVFI');
  expect(afterCursorFromNextPageUrl(null)).toBeNull();
});

it('o dia do Instagram fecha à meia-noite do Pacífico', () => {
  expect(instagramDayFromEndTime(new Date('2026-09-03T07:00:00Z'))).toBe('2026-09-02');
});

it('não puxa de novo o histórico da mesma conta, mas puxa se a conta mudou', () => {
  expect(needsHistoryBackfill(undefined, 'conta')).toBe(true);
  expect(needsHistoryBackfill({ status: 'done', instagramAccountId: 'conta' }, 'conta')).toBe(false);
  expect(needsHistoryBackfill({ status: 'done', instagramAccountId: 'outra' }, 'conta')).toBe(true);
  expect(needsHistoryBackfill({ status: 'failed', instagramAccountId: 'conta' }, 'conta')).toBe(true);
});

it('grava só posts mais velhos que a janela do sync, sem IA, e pula o que já tem número', async () => {
  (fetchInstagramMedia as jest.Mock).mockResolvedValue({ success: true, nextPageUrl: null, data: [
    { id: 'recente', media_type: 'VIDEO', media_product_type: 'REELS', timestamp: daysAgo(10) },
    { id: 'antigo', media_type: 'VIDEO', media_product_type: 'REELS', media_url: 'https://cdn/video.mp4', timestamp: daysAgo(300) },
    { id: 'antigo-medido', media_type: 'IMAGE', media_product_type: 'FEED', timestamp: daysAgo(400) },
  ] });
  (MetricModel.find as jest.Mock).mockReturnValue(chain([{ instagramMediaId: 'antigo-medido', type: 'IMAGE', stats: { reach: 50 } }]));

  const result = await runInstagramHistoryBackfillStep({ userId, now });

  expect(result).toMatchObject({ status: 'done', pagesRead: 1, postsSaved: 1, followerDaysSaved: 1 });
  expect(fetchMediaInsights).toHaveBeenCalledTimes(1);
  expect(saveMetricData).toHaveBeenCalledTimes(1);
  expect((saveMetricData as jest.Mock).mock.calls[0][1]).toMatchObject({ id: 'antigo', video_duration: 42 });
  expect((saveMetricData as jest.Mock).mock.calls[0][3]).toEqual({ skipAiReadings: true, skipMediaUrls: true });
  expect(InstagramNewFollowersDayModel.bulkWrite).toHaveBeenCalledWith([expect.objectContaining({
    updateOne: expect.objectContaining({ filter: expect.objectContaining({ date: '2026-09-28' }) }),
  })]);
});

it('limite do Instagram devolve a mesma página para recomeçar depois', async () => {
  (fetchInstagramMedia as jest.Mock).mockResolvedValue({ success: true, nextPageUrl: 'https://x/media?after=PROX', data: [
    { id: 'antigo', media_type: 'VIDEO', media_product_type: 'REELS', timestamp: daysAgo(300) },
  ] });
  (MetricModel.find as jest.Mock).mockReturnValue(chain([]));
  (fetchMediaInsights as jest.Mock).mockResolvedValue({ success: false, error: '(#4) Application request limit reached' });

  const result = await runInstagramHistoryBackfillStep({ userId, after: 'ATUAL', now });

  expect(result).toMatchObject({ status: 'rate_limited', after: 'ATUAL', postsSaved: 0 });
  expect(saveMetricData).not.toHaveBeenCalled();
  // Continuação não refaz os seguidores.
  expect(fetchDailyNewFollowers).not.toHaveBeenCalled();
});

it('simulação não grava nada', async () => {
  (fetchInstagramMedia as jest.Mock).mockResolvedValue({ success: true, nextPageUrl: null, data: [
    { id: 'antigo', media_type: 'VIDEO', media_product_type: 'REELS', timestamp: daysAgo(300) },
  ] });
  (MetricModel.find as jest.Mock).mockReturnValue(chain([]));

  const result = await runInstagramHistoryBackfillStep({ userId, now, dryRun: true });

  expect(result).toMatchObject({ status: 'done', postsSaved: 1 });
  expect(saveMetricData).not.toHaveBeenCalled();
  expect(DbUser.updateOne).not.toHaveBeenCalled();
  expect(InstagramNewFollowersDayModel.bulkWrite).not.toHaveBeenCalled();
});

it('vídeo antigo já medido mas sem duração volta para ganhar retenção', async () => {
  (fetchInstagramMedia as jest.Mock).mockResolvedValue({ success: true, nextPageUrl: null, data: [
    { id: 'reel-sem-duracao', media_type: 'VIDEO', media_product_type: 'REELS', media_url: 'https://cdn/v.mp4', timestamp: daysAgo(300) },
  ] });
  (MetricModel.find as jest.Mock).mockReturnValue(chain([{ instagramMediaId: 'reel-sem-duracao', type: 'REEL', stats: { reach: 50 } }]));

  const result = await runInstagramHistoryBackfillStep({ userId, now });

  expect(result).toMatchObject({ status: 'done', postsSaved: 1 });
});

it('para no limite de dois anos em vez de puxar a conta inteira', async () => {
  (fetchInstagramMedia as jest.Mock).mockResolvedValue({ success: true, nextPageUrl: 'https://x/media?after=MAIS', data: [
    { id: 'um-ano', media_type: 'VIDEO', media_product_type: 'REELS', media_url: 'https://cdn/a.mp4', timestamp: daysAgo(365) },
    { id: 'tres-anos', media_type: 'IMAGE', media_product_type: 'FEED', timestamp: daysAgo(1095) },
  ] });
  (MetricModel.find as jest.Mock).mockReturnValue(chain([]));

  const result = await runInstagramHistoryBackfillStep({ userId, now });

  expect(result).toMatchObject({ status: 'done', pagesRead: 1, postsSaved: 1 });
  expect((saveMetricData as jest.Mock).mock.calls.map((call) => call[1].id)).toEqual(['um-ano']);
});
