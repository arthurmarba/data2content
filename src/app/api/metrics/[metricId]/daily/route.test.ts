import { GET } from './route';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { connectToDatabase } from '@/app/lib/mongoose';
import MetricModel from '@/app/models/Metric';
import DailyMetricSnapshotModel from '@/app/models/DailyMetricSnapshot';
import mongoose from 'mongoose';

jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/app/api/auth/[...nextauth]/route', () => ({
  authOptions: {},
}));

jest.mock('@/app/lib/mongoose', () => ({
  connectToDatabase: jest.fn(),
}));

jest.mock('@/app/models/Metric', () => ({
  findOne: jest.fn(),
  findById: jest.fn(),
}));

jest.mock('@/app/models/DailyMetricSnapshot', () => ({
  find: jest.fn(),
}));

const mockGetServerSession = getServerSession as jest.Mock;
const mockConnect = connectToDatabase as jest.Mock;
const mockMetricFindOne = (MetricModel as any).findOne as jest.Mock;
const mockMetricFindById = (MetricModel as any).findById as jest.Mock;
const mockSnapshotFind = (DailyMetricSnapshotModel as any).find as jest.Mock;

const createRequest = (metricId: string) =>
  new NextRequest(`http://localhost/api/metrics/${metricId}/daily`);

beforeEach(() => {
  jest.clearAllMocks();
  mockConnect.mockResolvedValue(undefined);
});

describe('GET /api/metrics/[metricId]/daily', () => {
  it('returns 401 when user is not authenticated', async () => {
    const metricId = new mongoose.Types.ObjectId().toString();
    mockGetServerSession.mockResolvedValue(null);

    const res = await GET(createRequest(metricId), { params: { metricId } });

    expect(res.status).toBe(401);
  });

  it('returns snapshots when authenticated', async () => {
    const metricId = new mongoose.Types.ObjectId().toString();
    const userId = new mongoose.Types.ObjectId().toString();
    mockGetServerSession.mockResolvedValue({ user: { id: userId } });

    const findOneLean = jest.fn().mockResolvedValue({ _id: metricId });
    const findOneSelect = jest.fn().mockReturnValue({ lean: findOneLean });
    mockMetricFindOne.mockReturnValue({ select: findOneSelect });

    const snapshotDocs = [
      { date: new Date('2024-01-01'), dailyViews: 10, cumulativeViews: 10 },
    ];
    const snapLean = jest.fn().mockResolvedValue(snapshotDocs);
    const snapSelect = jest.fn().mockReturnValue({ lean: snapLean });
    const snapSort = jest.fn().mockReturnValue({ select: snapSelect });
    mockSnapshotFind.mockReturnValue({ sort: snapSort });

    const res = await GET(createRequest(metricId), { params: { metricId } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body[0].date).toBe('2024-01-01');
  });
});
