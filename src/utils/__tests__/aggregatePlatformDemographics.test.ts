import aggregatePlatformDemographics from '../aggregatePlatformDemographics';
import AudienceDemographicSnapshotModel from '@/app/models/demographics/AudienceDemographicSnapshot';
import UserModel from '@/app/models/User';
import { connectToDatabase } from '@/app/lib/mongoose';

jest.mock('@/app/models/demographics/AudienceDemographicSnapshot', () => ({
  aggregate: jest.fn(),
}));

jest.mock('@/app/models/User', () => ({
  find: jest.fn(),
}));

jest.mock('@/app/lib/mongoose', () => ({
  connectToDatabase: jest.fn(),
}));

const mockAgg = AudienceDemographicSnapshotModel.aggregate as jest.Mock;
const mockFind = UserModel.find as jest.Mock;
const mockConnect = connectToDatabase as jest.Mock;

describe('aggregatePlatformDemographics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConnect.mockResolvedValue(undefined);
  });

  it('sums demographic data of latest snapshots', async () => {
    mockFind.mockReturnValue({ select: () => ({ lean: () => Promise.resolve([{ _id: 'u1' }, { _id: 'u2' }]) }) });
    mockAgg.mockResolvedValueOnce([
      { demographics: { follower_demographics: { country: { BR: 100 }, gender: { f: 60, m: 40 } } } },
      { demographics: { follower_demographics: { country: { US: 50 }, gender: { f: 20, m: 30 } } } },
    ]);

    const res = await aggregatePlatformDemographics();
    expect(mockConnect).toHaveBeenCalled();
    expect(mockAgg).toHaveBeenCalled();
    expect(res.follower_demographics.country.BR).toBe(100);
    expect(res.follower_demographics.country.US).toBe(50);
    expect(res.follower_demographics.gender.f).toBe(80);
    expect(res.follower_demographics.gender.m).toBe(70);
  });

  it('returns empty maps when no active users', async () => {
    mockFind.mockReturnValue({ select: () => ({ lean: () => Promise.resolve([]) }) });
    const res = await aggregatePlatformDemographics();
    expect(res.follower_demographics.country).toEqual({});
    expect(mockAgg).not.toHaveBeenCalled();
  });
});
