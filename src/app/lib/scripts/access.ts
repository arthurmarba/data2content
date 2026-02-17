import type { Session } from "next-auth";
import { Types } from "mongoose";
import { ensurePlannerAccess } from "@/app/lib/planGuard";
import { isPlanActiveLike, normalizePlanStatus } from "@/utils/planStatus";

export function hasScriptsAccess(user: any): boolean {
  if (!user) return false;
  const normalizedStatus = normalizePlanStatus(user?.planStatus);
  const role = typeof user?.role === "string" ? user.role.trim().toLowerCase() : null;
  const proTrialStatus = typeof user?.proTrialStatus === "string" ? user.proTrialStatus.trim().toLowerCase() : null;
  return isPlanActiveLike(normalizedStatus) || proTrialStatus === "active" || role === "admin";
}

export async function validateScriptsAccess(params: {
  request: Request;
  session: Session;
}): Promise<{ ok: true } | { ok: false; status: number; error: string; reason?: string }> {
  const { request, session } = params;
  const routePath = new URL(request.url).pathname;
  const access = await ensurePlannerAccess({ session, routePath, forceReload: true });
  if (!access.ok) {
    return {
      ok: false,
      status: access.status,
      error: access.message,
      reason: access.reason,
    };
  }

  if (!hasScriptsAccess(session?.user)) {
    return {
      ok: false,
      status: 403,
      error: "Plano inativo. Assine para acessar Meus Roteiros.",
      reason: "inactive",
    };
  }

  return { ok: true };
}

export function hasAdminRole(user: any): boolean {
  if (!user) return false;
  const normalizedRole =
    typeof user?.role === "string" ? user.role.trim().toLowerCase() : "";
  return normalizedRole === "admin" || user?.isAdmin === true;
}

export function resolveTargetScriptsUser(params: {
  session: Session;
  targetUserId?: string | null;
}):
  | {
      ok: true;
      userId: string;
      isAdminActor: boolean;
      isActingOnBehalf: boolean;
    }
  | {
      ok: false;
      status: number;
      error: string;
    } {
  const { session, targetUserId } = params;
  const sessionUserId = typeof session?.user?.id === "string" ? session.user.id : "";

  if (!sessionUserId || !Types.ObjectId.isValid(sessionUserId)) {
    return { ok: false, status: 401, error: "Usuário autenticado inválido." };
  }

  const normalizedTarget = typeof targetUserId === "string" ? targetUserId.trim() : "";
  if (!normalizedTarget) {
    return {
      ok: true,
      userId: sessionUserId,
      isAdminActor: hasAdminRole(session?.user),
      isActingOnBehalf: false,
    };
  }

  if (!Types.ObjectId.isValid(normalizedTarget)) {
    return { ok: false, status: 400, error: "targetUserId inválido." };
  }

  if (normalizedTarget === sessionUserId) {
    return {
      ok: true,
      userId: sessionUserId,
      isAdminActor: hasAdminRole(session?.user),
      isActingOnBehalf: false,
    };
  }

  if (!hasAdminRole(session?.user)) {
    return {
      ok: false,
      status: 403,
      error: "Apenas administradores podem gerar roteiros para outro usuário.",
    };
  }

  return {
    ok: true,
    userId: normalizedTarget,
    isAdminActor: true,
    isActingOnBehalf: true,
  };
}
