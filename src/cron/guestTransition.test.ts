import { handleGuestTransitions } from './guestTransition';
import { connectToDatabase } from '@/app/lib/mongoose';
import UserModel from '@/app/models/User';
import { sendGuestMigrationEmail } from '@/app/lib/emailService';

jest.mock('@/app/lib/mongoose', () => ({ connectToDatabase: jest.fn() }));
jest.mock('@/app/models/User', () => ({ find: jest.fn() }));
jest.mock('@/app/lib/emailService', () => ({ sendGuestMigrationEmail: jest.fn() }));
jest.mock('@/app/lib/logger', () => ({ logger: { info: jest.fn(), error: jest.fn() } }));

const mockFind = (UserModel as any).find as jest.Mock;
const mockSend = sendGuestMigrationEmail as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  (connectToDatabase as jest.Mock).mockResolvedValue(undefined);
});

describe('handleGuestTransitions', () => {
  it('converts expired guests and sends warning emails', async () => {
    const now = new Date();
    const expiring = {
      _id: '1',
      email: 'a@test.com',
      planExpiresAt: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
      role: 'guest',
      planStatus: 'active',
      agency: 'ag1',
      save: jest.fn(),
    };
    const expired = {
      _id: '2',
      email: 'b@test.com',
      planExpiresAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      role: 'guest',
      planStatus: 'active',
      agency: 'ag1',
      save: jest.fn(),
    };
    mockFind.mockResolvedValue([expiring, expired]);

    await handleGuestTransitions();

    expect(mockSend).toHaveBeenCalledWith(expiring.email, expiring.planExpiresAt);
    expect(expired.role).toBe('user');
    expect(expired.planStatus).toBe('inactive');
    expect(expired.agency).toBeNull();
    expect(expired.save).toHaveBeenCalled();
    expect(expiring.save).not.toHaveBeenCalled();
  });
});
