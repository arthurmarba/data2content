import { normalizePlanStatus, isPlanActiveLike } from "@/utils/planStatus";

export function hasPlannerAccess(user: any): boolean {
  if (!user) return false;
  const normalizedStatus = normalizePlanStatus(user?.planStatus);
  const role = typeof user?.role === "string" ? user.role.trim().toLowerCase() : null;
  return isPlanActiveLike(normalizedStatus) || role === "admin";
}
