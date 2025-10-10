const ACTIVE_LIKE_STATUSES = new Set(["active", "trial", "trialing", "non_renewing"]);
const INACTIVE_STATUSES = new Set([
  "inactive",
  "expired",
  "canceled",
  "unpaid",
  "incomplete_expired",
]);

export type NormalizedPlanStatus =
  | "active"
  | "trial"
  | "trialing"
  | "non_renewing"
  | "inactive"
  | "expired"
  | "canceled"
  | "unpaid"
  | "pending"
  | "past_due"
  | "incomplete"
  | "incomplete_expired"
  | "unknown";

function toNormalizedString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object" && "toString" in (value as object)) {
    try {
      const str = (value as { toString: () => string }).toString();
      if (typeof str === "string") return str;
    } catch {
      return "";
    }
  }
  return "";
}

export function normalizePlanStatus(value: unknown): NormalizedPlanStatus {
  let result = toNormalizedString(value).trim().toLowerCase();
  if (!result) return "unknown";
  result = result.replace(/[\s-]+/g, "_").replace(/_+/g, "_");
  if (result === "nonrenewing") result = "non_renewing";
  if (result === "trialling") result = "trialing";

  if (ACTIVE_LIKE_STATUSES.has(result)) return result as NormalizedPlanStatus;
  if (INACTIVE_STATUSES.has(result)) return result as NormalizedPlanStatus;
  if (result === "past_due" || result === "pastdue") return "past_due";
  if (result === "incomplete" || result === "incomplete_pending" || result === "incomplete_payment") return "incomplete";
  if (result === "pending_payment" || result === "pending_payment_required" || result === "pending") return "pending";
  if (result === "trial") return "trial";
  if (result === "incompleteexpired") return "incomplete_expired";

  return "unknown";
}

export function isPlanActiveLike(status: unknown): boolean {
  const normalized = normalizePlanStatus(status);
  return ACTIVE_LIKE_STATUSES.has(normalized);
}

export function hasPlanGracePeriod(
  status: unknown,
  cancelAtPeriodEnd?: boolean | null
): boolean {
  const normalized = normalizePlanStatus(status);
  if (normalized === "non_renewing") return true;
  if (normalized === "active" && !!cancelAtPeriodEnd) return true;
  return false;
}

export function hasPlanPremiumAccess(
  status: unknown,
  cancelAtPeriodEnd?: boolean | null
): boolean {
  const normalized = normalizePlanStatus(status);
  if (ACTIVE_LIKE_STATUSES.has(normalized)) return true;
  if (normalized === "unknown" && !!cancelAtPeriodEnd) return true;
  if (normalized === "active" && !!cancelAtPeriodEnd) return true;
  return false;
}

export function needsPlanBillingAttention(
  status: unknown
): boolean {
  const normalized = normalizePlanStatus(status);
  if (ACTIVE_LIKE_STATUSES.has(normalized)) return false;
  if (normalized === "unknown") return true;
  if (INACTIVE_STATUSES.has(normalized)) return true;
  if (normalized === "unpaid" || normalized === "incomplete_expired") return true;
  if (normalized === "pending" || normalized === "past_due" || normalized === "incomplete") return true;
  return true;
}

export type PlanAccessMeta = {
  normalizedStatus: NormalizedPlanStatus;
  hasPremiumAccess: boolean;
  isGracePeriod: boolean;
  needsBilling: boolean;
};

export function getPlanAccessMeta(
  status: unknown,
  cancelAtPeriodEnd?: boolean | null
): PlanAccessMeta {
  const normalizedStatus = normalizePlanStatus(status);
  const hasPremiumAccess = hasPlanPremiumAccess(normalizedStatus, cancelAtPeriodEnd);
  const isGracePeriod = hasPlanGracePeriod(normalizedStatus, cancelAtPeriodEnd);
  const needsBilling = needsPlanBillingAttention(normalizedStatus) && !hasPremiumAccess;
  return { normalizedStatus, hasPremiumAccess, isGracePeriod, needsBilling };
}
