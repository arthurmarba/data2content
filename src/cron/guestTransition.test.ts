import { handleGuestTransitions } from './guestTransition';
import { connectToDatabase } from '@/app/lib/mongoose';
import UserModel from '@/app/models/User';
import { sendGuestMigrationEmail, sendVipInviteEmail } from '@/app/lib/emailService';
import { sendTemplateMessage } from '@/app/lib/whatsappService';
import billingService from '@/services/billingService';
import { logger } from '@/app/lib/logger';

jest.mock('@/app/lib/mongoose', () => ({ connectToDatabase: jest.fn() }));
jest.mock('@/app/models/User', () => ({ find: jest.fn() }));
jest.mock('@/app/lib/emailService', () => ({
  sendGuestMigrationEmail: jest.fn(),
  sendVipInviteEmail: jest.fn(),
}));
jest.mock('@/app/lib/whatsappService', () => ({ sendTemplateMessage: jest.fn() }));
jest.mock('@/services/billingService', () => ({ __esModule: true, default: { updateSubscription: jest.fn() } }));
jest.mock('@/app/lib/logger', () => ({ logger: { info: jest.fn(), error: jest.fn() } }));

const mockFind = (UserModel as any).find as jest.Mock;
const mockSend = sendGuestMigrationEmail as jest.Mock;
const mockVipInvite = sendVipInviteEmail as jest.Mock;
const mockBilling = billingService.updateSubscription as jest.Mock;
const mockWhatsApp = sendTemplateMessage as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  (connectToDatabase as jest.Mock).mockResolvedValue(undefined);
});

describe('handleGuestTransitions', () => {
  it('converts expired guests, updates billing, and sends warning emails', async () => {
    const now = new Date();
    const expired = {
      _id: '2',
      email: 'b@test.com',
      name: 'Bia',
      planExpiresAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      role: 'guest',
      planStatus: 'active',
      agency: 'ag1',
      save: jest.fn(),
      whatsappVerified: true,
      whatsappPhone: '+5511999999999',
    };
    mockFind.mockResolvedValue([expired]);
    mockBilling.mockResolvedValue(undefined);

    await handleGuestTransitions();

    expect(mockSend).toHaveBeenCalledWith(expired.email, expired.planExpiresAt);
    // O convite para o Grupo VIP sai junto do aviso de migração.
    expect(mockVipInvite).toHaveBeenCalledWith(expired.email, { name: expired.name });
    // O lembrete no WhatsApp é um template aprovado, com o link do painel de assinatura.
    expect(mockWhatsApp).toHaveBeenCalledWith(expired.whatsappPhone, expect.any(String), [
      {
        type: 'body',
        parameters: [{ type: 'text', text: expect.stringContaining('/dashboard/billing') }],
      },
    ]);
    expect(mockBilling).toHaveBeenCalledWith(expired._id);
    expect(expired.role).toBe('user');
    expect(expired.planStatus).toBe('inactive');
    expect(expired.agency).toBeNull();
    expect(expired.save).toHaveBeenCalled();
  });

  it('logs error when billing update fails', async () => {
    const now = new Date();
    const expired = {
      _id: '1',
      email: 'a@test.com',
      planExpiresAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      role: 'guest',
      planStatus: 'active',
      agency: 'ag1',
      save: jest.fn(),
    };
    mockFind.mockResolvedValue([expired]);
    mockBilling.mockRejectedValue(new Error('billing fail'));

    await handleGuestTransitions();

    expect(mockBilling).toHaveBeenCalledWith(expired._id);
    expect(logger.error).toHaveBeenCalled();
  });
});
