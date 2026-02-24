import { Types } from 'mongoose';

export const hasAdminRole = (user: any): boolean => {
  if (!user) return false;
  const normalizedRole = typeof user?.role === 'string' ? user.role.trim().toLowerCase() : '';
  return normalizedRole === 'admin' || user?.isAdmin === true;
};

export const resolveTargetCalculatorUser = (params: {
  session: any;
  targetUserId?: string | null;
  forbiddenMessage?: string;
}):
  | { ok: true; userId: string; isAdminActor: boolean; isActingOnBehalf: boolean }
  | { ok: false; status: number; error: string } => {
  const { session, targetUserId, forbiddenMessage } = params;
  const sessionUserId = typeof session?.user?.id === 'string' ? session.user.id.trim() : '';
  const isAdminActor = hasAdminRole(session?.user);

  if (!sessionUserId || !Types.ObjectId.isValid(sessionUserId)) {
    return { ok: false, status: 401, error: 'Usuário autenticado inválido.' };
  }

  const normalizedTargetUserId = typeof targetUserId === 'string' ? targetUserId.trim() : '';
  if (!normalizedTargetUserId || normalizedTargetUserId === sessionUserId) {
    return {
      ok: true,
      userId: sessionUserId,
      isAdminActor,
      isActingOnBehalf: false,
    };
  }

  if (!Types.ObjectId.isValid(normalizedTargetUserId)) {
    return { ok: false, status: 400, error: 'targetUserId inválido.' };
  }

  if (!isAdminActor) {
    return {
      ok: false,
      status: 403,
      error: forbiddenMessage || 'Apenas administradores podem calcular para outro criador.',
    };
  }

  return {
    ok: true,
    userId: normalizedTargetUserId,
    isAdminActor: true,
    isActingOnBehalf: true,
  };
};
