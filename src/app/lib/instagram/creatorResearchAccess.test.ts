/** @jest-environment node */
import Grant from '@/app/models/CreatorResearchReviewGrant';
import { getMcpAdminAuthorization } from '@/app/lib/mcp/adminAuthorization';
import { getCreatorResearchAccess } from './creatorResearchAccess';
jest.mock('@/app/models/CreatorResearchReviewGrant', () => ({ __esModule: true, default: { exists: jest.fn() } }));
jest.mock('@/app/lib/mcp/adminAuthorization', () => ({ getMcpAdminAuthorization: jest.fn() }));
beforeEach(() => jest.clearAllMocks());
it('mantém o administrador e não consulta concessões', async () => {
  (getMcpAdminAuthorization as jest.Mock).mockResolvedValue({ authorized: true });
  expect(await getCreatorResearchAccess('dono')).toBe('admin');
  expect(Grant.exists).not.toHaveBeenCalled();
});
it.each(['invalid_identity', 'user_not_found', 'not_allowlisted', 'authorization_unavailable'])('não contorna %s com concessão de revisão', async reason => {
  (getMcpAdminAuthorization as jest.Mock).mockResolvedValue({ authorized: false, reason });
  expect(await getCreatorResearchAccess('dono')).toBeNull();
  expect(Grant.exists).not.toHaveBeenCalled();
});
it('exige concessão vigente do próprio usuário existente', async () => {
  (getMcpAdminAuthorization as jest.Mock).mockResolvedValue({ authorized: false, reason: 'admin_role_required' });
  (Grant.exists as jest.Mock).mockResolvedValueOnce({ _id: 'concessao' }).mockResolvedValueOnce(null);
  expect(await getCreatorResearchAccess('dono')).toBe('review');
  expect(Grant.exists).toHaveBeenCalledWith({ owner: 'dono', expiresAt: { $gt: expect.any(Date) } });
  expect(await getCreatorResearchAccess('sem-concessao')).toBeNull();
});
it('falha fechado quando a consulta à concessão falha', async () => {
  (getMcpAdminAuthorization as jest.Mock).mockResolvedValue({ authorized: false, reason: 'admin_role_required' });
  (Grant.exists as jest.Mock).mockRejectedValueOnce(new Error('falha'));
  expect(await getCreatorResearchAccess('dono')).toBeNull();
});
