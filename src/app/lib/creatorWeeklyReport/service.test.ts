/** @jest-environment node */
import { generateCreatorWeeklyReport } from './service';
import { buildCreatorWeeklyReport } from './engine';
import { lastClosedWeek } from '@/app/lib/relatorio/weekWindow';

const mockLean = (value: unknown) => ({ lean: jest.fn().mockResolvedValue(value) });
const mockFindReport = jest.fn();
const mockUpdateReport = jest.fn();
const mockWinner = jest.fn();
const mockCreate = jest.fn();
const mockMetrics = jest.fn();
jest.mock('@/app/lib/mongoose', () => ({ connectToDatabase: jest.fn() }));
jest.mock('@/app/models/CreatorWeeklyReport', () => ({ __esModule: true, default: {
  findOne: (...args: unknown[]) => mockFindReport(...args),
  findOneAndUpdate: (...args: unknown[]) => mockUpdateReport(...args),
  findById: (...args: unknown[]) => mockWinner(...args),
  create: (...args: unknown[]) => mockCreate(...args),
} }));
jest.mock('@/app/models/Metric', () => ({ __esModule: true, default: {
  collection: { name: 'metrics' }, find: () => ({ select: () => ({ sort: () => ({ lean: () => mockMetrics() }) }) }),
} }));
jest.mock('@/app/models/ContentReadingState', () => ({ __esModule: true, default: { find: () => ({ select: () => ({ lean: async () => [] }) }) } }));
jest.mock('@/app/models/MapaSeed', () => ({ __esModule: true, default: { findOne: () => ({ select: () => ({ lean: async () => null }) }) } }));
jest.mock('@/app/models/User', () => ({ __esModule: true, default: { findById: () => ({ select: () => ({ lean: async () => null }) }) } }));
jest.mock('@/app/models/DailyMetricSnapshot', () => ({ __esModule: true, default: { aggregate: async () => [] } }));

const userId = '69e8f96564be9f1592a5ca6e';
const now = new Date('2026-09-08T12:00:00Z');
const week = lastClosedWeek(now);
const post = { _id: 'p1', postDate: '2026-09-01', updatedAt: now, stats: { shares: 2 }, sceneElements: { version: 'v1', analyzedAt: '2026-09-02', subjects: ['Casa'] } };
const payload = buildCreatorWeeklyReport({ metrics: [post], generatedAt: now, week });
const stored = { _id: 'relatorio', userId, createdAt: now, updatedAt: now, schemaVersion: 1, payload };

beforeEach(() => { jest.clearAllMocks(); mockMetrics.mockResolvedValue([post]); mockFindReport.mockReturnValue(mockLean(stored)); });

it('preserva o vencedor quando outro worker grava antes do término', async () => {
  const winner = { ...stored, payload: { ...payload, overview: { ...payload.overview, summary: 'Versão mais nova' } } };
  mockUpdateReport.mockReturnValue(mockLean(null));
  mockWinner.mockReturnValue(mockLean(winner));
  const result = await generateCreatorWeeklyReport({ userId, now });
  expect(result.report.overview.summary).toBe('Versão mais nova');
  expect(mockUpdateReport.mock.calls[0][0]).toEqual({ _id: stored._id, updatedAt: stored.updatedAt });
  expect(mockUpdateReport.mock.calls[0][1].$set.previousPayload).toEqual(payload);
});

it('detecta mudança de evidência mesmo sem alterar o maior updatedAt', async () => {
  mockUpdateReport.mockReturnValue(mockLean(stored));
  await generateCreatorWeeklyReport({ userId, now });
  const firstRevision = mockUpdateReport.mock.calls[0][1].$set.sourceRevision;
  mockMetrics.mockResolvedValue([{ ...post, sceneElements: { ...post.sceneElements, subjects: ['Novo assunto'] } }]);
  await generateCreatorWeeklyReport({ userId, now });
  expect(mockUpdateReport.mock.calls[1][1].$set.sourceRevision).not.toBe(firstRevision);
});

it('incorpora semana corrente apenas à leitura recente', async () => {
  const newPost = { ...post, _id: 'p2', postDate: '2026-09-08T08:00:00Z', sceneElements: { ...post.sceneElements, subjects: ['Novo assunto'] } };
  mockMetrics.mockResolvedValue([post, newPost]);
  mockUpdateReport.mockImplementation((_query, update) => mockLean({ ...stored, ...update.$set }));
  const result = await generateCreatorWeeklyReport({ userId, now });
  expect(result.report.coverage.postsWeek).toBe(1);
  expect(result.report.evolution?.allObservedSubjects).toContain('Novo assunto');
  expect(result.report.evolution?.windows.recent.imported).toBe(2);
});

it('resolve criação simultânea sem duplicar relatório', async () => {
  mockFindReport.mockReturnValueOnce(mockLean(null)).mockReturnValueOnce(mockLean(stored));
  mockCreate.mockRejectedValue({ code: 11000 });
  const result = await generateCreatorWeeklyReport({ userId, now });
  expect(result.id).toBe(stored._id);
  expect(mockUpdateReport).not.toHaveBeenCalled();
});
