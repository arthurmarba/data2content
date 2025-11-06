import { normalizePlanStatus, isPlanActiveLike } from "@/utils/planStatus";

export function hasPlannerAccess(user: any): boolean {
  if (!user) return false;
  const normalizedStatus = normalizePlanStatus(user?.planStatus);
  const role = typeof user?.role === "string" ? user.role.trim().toLowerCase() : null;
  const proTrialStatus = typeof user?.proTrialStatus === "string" ? user.proTrialStatus.trim().toLowerCase() : null;
  return isPlanActiveLike(normalizedStatus) || proTrialStatus === "active" || role === "admin";
}
