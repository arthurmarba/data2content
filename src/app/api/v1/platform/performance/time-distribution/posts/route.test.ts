import { GET } from './route';
import MetricModel from '@/app/models/Metric';
import { connectToDatabase } from '@/app/lib/mongoose';
import { NextRequest } from 'next/server';

jest.mock('@/app/models/Metric', () => ({
  aggregate: jest.fn(),
}));

jest.mock('@/app/lib/mongoose', () => ({
  connectToDatabase: jest.fn(),
}));

const mockAgg = MetricModel.aggregate as jest.Mock;
const mockConnect = connectToDatabase as jest.Mock;

const makeRequest = (search = '') => new NextRequest(`http://localhost/api/v1/platform/performance/time-distribution/posts${search}`);

const mockAggregateExec = (rows: any[]) => ({
  exec: jest.fn().mockResolvedValue(rows),
});

describe('GET /api/v1/platform/performance/time-distribution/posts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConnect.mockResolvedValue(undefined);
  });

  it('returns posts list', async () => {
    mockAgg.mockReturnValueOnce(mockAggregateExec([{ _id: 'p1', metricValue: 10 }]));

    const res = await GET(makeRequest('?dayOfWeek=1&timeBlock=6-12&timePeriod=last_30_days'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockAgg).toHaveBeenCalled();
    expect(body.posts[0].metricValue).toBe(10);
  });

  it('applies tone and reference filters when provided', async () => {
    mockAgg.mockReturnValueOnce(mockAggregateExec([]));

    await GET(makeRequest('?dayOfWeek=1&timeBlock=6-12&timePeriod=last_30_days&tone=promotional&references=city'));

    const pipeline = mockAgg.mock.calls[0][0];
    expect(pipeline[0]).toEqual(expect.objectContaining({
      $match: expect.objectContaining({
        tone: { $in: expect.arrayContaining(['promotional', 'Promocional/Comercial']) },
        references: { $in: expect.arrayContaining(['city', 'Cidade']) },
      }),
    }));
  });
});
