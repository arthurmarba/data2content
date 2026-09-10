import Grant from '@/app/models/CreatorResearchReviewGrant';
import { getMcpAdminAuthorization } from '@/app/lib/mcp/adminAuthorization';

export async function getCreatorResearchAccess(owner: string): Promise<'admin' | 'review' | null> {
  const admin = await getMcpAdminAuthorization(owner);
  if (admin.authorized) return 'admin';
  // Usuário inexistente, erro de banco e administrador fora da lista não ganham fallback.
  if (admin.reason !== 'admin_role_required') return null;
  try {
    const grant = await Grant.exists({ owner, expiresAt: { $gt: new Date() } });
    return grant ? 'review' : null;
  } catch { return null; }
}
