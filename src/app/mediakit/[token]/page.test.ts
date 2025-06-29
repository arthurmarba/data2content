import MediaKitPage from './page';
import UserModel from '@/app/models/User';
import { connectToDatabase } from '@/app/lib/mongoose';
import { logMediaKitAccess } from '@/lib/logMediaKitAccess';
import { headers } from 'next/headers';

global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });

jest.mock('@/app/lib/mongoose', () => ({ connectToDatabase: jest.fn() }));
jest.mock('@/app/models/User', () => ({ findOne: jest.fn() }));
jest.mock('@/lib/logMediaKitAccess', () => ({ logMediaKitAccess: jest.fn() }));
jest.mock('next/headers', () => ({ headers: jest.fn() }));

type Params = { params: { token: string } };

const mockFindOne = UserModel.findOne as jest.Mock;
const mockLogAccess = logMediaKitAccess as jest.Mock;
const mockHeaders = headers as jest.Mock;

describe('MediaKitPage logging', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHeaders.mockReturnValue(new Headers({ 'x-real-ip': '1.1.1.1' }));
    mockFindOne.mockReturnValue({ lean: () => Promise.resolve({ _id: 'u1' }) });
  });

  it('calls logMediaKitAccess when user exists', async () => {
    await MediaKitPage({ params: { token: 'tok' } } as Params);
    expect(mockLogAccess).toHaveBeenCalledWith('u1', '1.1.1.1', undefined);
  });
});
