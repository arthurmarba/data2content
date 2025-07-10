import { GET } from './route';
import aggregatePlatformDemographics from '@/utils/aggregatePlatformDemographics';
import { NextRequest } from 'next/server';

jest.mock('@/utils/aggregatePlatformDemographics');

const mockAgg = aggregatePlatformDemographics as jest.Mock;
const makeRequest = () => new NextRequest('http://localhost/api/v1/platform/demographics');

describe('GET /api/v1/platform/demographics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns aggregated demographics', async () => {
    mockAgg.mockResolvedValueOnce({ follower_demographics: { country: { BR: 10 } } });
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.follower_demographics.country.BR).toBe(10);
    expect(mockAgg).toHaveBeenCalled();
  });

  it('returns 500 on error', async () => {
    mockAgg.mockRejectedValueOnce(new Error('fail'));
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error).toContain('Erro ao processar');
  });
});
