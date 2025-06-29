import MediaKitPage from '../[token]/page';
import { connectToDatabase } from '@/app/lib/mongoose';
import UserModel from '@/app/models/User';
import { logMediaKitAccess } from '@/app/lib/logger';
import { notFound } from 'next/navigation';

jest.mock('@/app/lib/mongoose', () => ({
  connectToDatabase: jest.fn(),
}));

jest.mock('@/app/models/User', () => ({
  findOne: jest.fn(),
}));

jest.mock('@/app/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  logMediaKitAccess: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  notFound: jest.fn(),
}));

const mockConnect = connectToDatabase as jest.Mock;
const mockFindOne = (UserModel as any).findOne as jest.Mock;
const mockLogAccess = logMediaKitAccess as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockConnect.mockResolvedValue(undefined);
  mockFindOne.mockReturnValue({ lean: jest.fn().mockResolvedValue({ _id: 'u1', name: 'User' }) });
  global.fetch = jest.fn(() => Promise.resolve(new Response('null'))) as any;
});

test('logs access when page is rendered', async () => {
  await MediaKitPage({ params: { token: 'tok123' } });
  expect(mockLogAccess).toHaveBeenCalledWith('tok123');
});
