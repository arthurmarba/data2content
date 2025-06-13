import { GET } from './route'; // Adjust path as necessary
import { fetchTopEngagingCreators } from '@/app/lib/dataService/marketAnalysisService';
import { NextRequest } from 'next/server';
import { DatabaseError } from '@/app/lib/errors';
import { ICreatorMetricRankItem } from '@/app/lib/dataService/marketAnalysisService';

// Mock the marketAnalysisService
jest.mock('@/app/lib/dataService/marketAnalysisService', () => ({
  ...jest.requireActual('@/app/lib/dataService/marketAnalysisService'), // Import and retain other functions
  fetchTopEngagingCreators: jest.fn(),
}));

// Helper to create a mock NextRequest
function mockNextRequest(queryParams: Record<string, string>): NextRequest {
  const url = new URL('http://localhost/api/admin/dashboard/rankings/creators/top-engaging');
  Object.entries(queryParams).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });
  return new NextRequest(url.toString());
}

const sampleRankingData: ICreatorMetricRankItem[] = [
  { creatorId: 'user1' as any, creatorName: 'Creator One', metricValue: 75.5, profilePictureUrl: 'url1' },
  { creatorId: 'user2' as any, creatorName: 'Creator Two', metricValue: 60.2, profilePictureUrl: 'url2' },
];

describe('API Route: /api/admin/dashboard/rankings/creators/top-engaging', () => {
  beforeEach(() => {
    // Reset mocks before each test
    (fetchTopEngagingCreators as jest.Mock).mockClear();
  });

  it('should return 200 with ranking data on successful request', async () => {
    (fetchTopEngagingCreators as jest.Mock).mockResolvedValueOnce(sampleRankingData);

    const request = mockNextRequest({
      startDate: '2023-01-01T00:00:00.000Z',
      endDate: '2023-01-31T23:59:59.999Z',
      limit: '2',
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(sampleRankingData);
    expect(fetchTopEngagingCreators).toHaveBeenCalledWith({
      dateRange: {
        startDate: new Date('2023-01-01T00:00:00.000Z'),
        endDate: new Date('2023-01-31T23:59:59.999Z'),
      },
      limit: 2,
    });
  });

  it('should return 400 if startDate is after endDate', async () => {
    const request = mockNextRequest({
      startDate: '2023-02-01T00:00:00.000Z',
      endDate: '2023-01-31T23:59:59.999Z', // startDate is after endDate
      limit: '5',
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('startDate cannot be after endDate');
    expect(fetchTopEngagingCreators).not.toHaveBeenCalled();
  });

  it('should return 400 if startDate is missing', async () => {
    const request = mockNextRequest({
      // startDate: '2023-01-01T00:00:00.000Z', // Missing startDate
      endDate: '2023-01-31T23:59:59.999Z',
      limit: '5',
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('startDate: Invalid datetime format.'); // Zod error message
    expect(fetchTopEngagingCreators).not.toHaveBeenCalled();
  });

  it('should return 400 if endDate is missing', async () => {
    const request = mockNextRequest({
      startDate: '2023-01-01T00:00:00.000Z',
      // endDate: '2023-01-31T23:59:59.999Z', // Missing endDate
      limit: '5',
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('endDate: Invalid datetime format.'); // Zod error message
    expect(fetchTopEngagingCreators).not.toHaveBeenCalled();
  });

  it('should return 400 if limit is not a number or out of range', async () => {
    const requestNonNumeric = mockNextRequest({
        startDate: '2023-01-01T00:00:00.000Z',
        endDate: '2023-01-31T23:59:59.999Z',
        limit: 'abc',
      });
      let response = await GET(requestNonNumeric);
      let body = await response.json();
      expect(response.status).toBe(400);
      expect(body.error).toContain("limit: Expected number, received nan");

      const requestOutOfRange = mockNextRequest({
        startDate: '2023-01-01T00:00:00.000Z',
        endDate: '2023-01-31T23:59:59.999Z',
        limit: '100', // max is 50
      });
      response = await GET(requestOutOfRange);
      body = await response.json();
      expect(response.status).toBe(400);
      // This message might vary based on Zod version and exact refinement error
      expect(body.error).toContain("limit: Number must be less than or equal to 50");
  });


  it('should return 500 if the service layer throws a DatabaseError', async () => {
    const serviceErrorMessage = 'Service failure fetching top engaging creators';
    (fetchTopEngagingCreators as jest.Mock).mockRejectedValueOnce(new DatabaseError(serviceErrorMessage));

    const request = mockNextRequest({
      startDate: '2023-01-01T00:00:00.000Z',
      endDate: '2023-01-31T23:59:59.999Z',
      limit: '5',
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toEqual(serviceErrorMessage);
    expect(fetchTopEngagingCreators).toHaveBeenCalledTimes(1);
  });

  it('should return 500 for unexpected errors', async () => {
    (fetchTopEngagingCreators as jest.Mock).mockRejectedValueOnce(new Error('Unexpected catastrophic error'));
    const request = mockNextRequest({
        startDate: '2023-01-01T00:00:00.000Z',
        endDate: '2023-01-31T23:59:59.999Z',
        limit: '5',
      });

      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toEqual('Ocorreu um erro interno no servidor.');
      expect(fetchTopEngagingCreators).toHaveBeenCalledTimes(1);
  });

});
