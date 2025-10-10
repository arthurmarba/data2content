// src/utils/authz.ts
// Helpers for authorization decisions shared across API routes and services.

export interface SessionUserLike {
  id?: string | null;
  role?: string | null;
}

/**
 * Returns true when the provided session user represents an administrator.
 */
export function isAdminUser(sessionUser?: SessionUserLike | null): boolean {
  if (!sessionUser?.role) return false;
  return String(sessionUser.role).toLowerCase() === 'admin';
}

export type AccessEvaluationResult = {
  allowed: boolean;
  reason?: 'unauthenticated' | 'forbidden';
  isAdmin: boolean;
  actorId: string;
  targetUserId: string;
};

/**
 * Evaluates if the actor (session user) can access resources for the target user.
 * When targetUserId is omitted, the actor id is assumed as the target.
 */
export function evaluateUserAccess(
  sessionUser: SessionUserLike | undefined | null,
  targetUserId?: string | null,
): AccessEvaluationResult {
  const actorId = sessionUser?.id ? String(sessionUser.id) : '';
  const isAdmin = isAdminUser(sessionUser);
  const normalizedTarget = targetUserId ? String(targetUserId) : '';

  if (!actorId) {
    return {
      allowed: false,
      reason: 'unauthenticated',
      isAdmin,
      actorId: '',
      targetUserId: normalizedTarget,
    };
  }

  const finalTarget = normalizedTarget || actorId;
  if (finalTarget === actorId) {
    return {
      allowed: true,
      isAdmin,
      actorId,
      targetUserId: finalTarget,
    };
  }

  if (isAdmin) {
    return {
      allowed: true,
      isAdmin,
      actorId,
      targetUserId: finalTarget,
    };
  }

  return {
    allowed: false,
    reason: 'forbidden',
    isAdmin,
    actorId,
    targetUserId: finalTarget,
  };
}
