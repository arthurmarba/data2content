import aggregateCreatorsByRegion from '../aggregateCreatorsByRegion';
import UserModel from '@/app/models/User';
import { connectToDatabase } from '@/app/lib/mongoose';

jest.mock('@/app/models/User', () => ({
  find: jest.fn(),
}));

jest.mock('@/app/lib/mongoose', () => ({
  connectToDatabase: jest.fn(),
}));

const mockFind = UserModel.find as jest.Mock;
const mockConnect = connectToDatabase as jest.Mock;

describe('aggregateCreatorsByRegion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConnect.mockResolvedValue(undefined);
  });

  it('aggregates creators by state with age and gender', async () => {
    mockFind.mockReturnValue({
      select: () => ({ lean: () => Promise.resolve([
        { location: { state: 'SP', city: 'Sao Paulo' }, birthDate: new Date('1990-01-01'), gender: 'male' },
        { location: { state: 'SP', city: 'Campinas' }, birthDate: new Date('1995-01-01'), gender: 'female' },
        { location: { state: 'RJ', city: 'Rio de Janeiro' }, birthDate: new Date('1985-01-01'), gender: 'female' },
      ]) })
    });

    const res = await aggregateCreatorsByRegion();
    expect(mockConnect).toHaveBeenCalled();
    expect(res.length).toBe(2);
    const sp = res.find(r => r.state === 'SP')!;
    expect(sp.count).toBe(2);
    expect(sp.cities['Sao Paulo'].count).toBe(1);
  });
});
