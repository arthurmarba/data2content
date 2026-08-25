import mongoose from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import UserModel from "@/app/models/User";

export type McpEntitlementReason =
  | "active"
  | "non_renewing"
  | "subscription_required"
  | "subscription_expired"
  | "user_not_found"
  | "invalid_identity"
  | "entitlement_unavailable";

export interface McpEntitlement {
  eligible: boolean;
  reason: McpEntitlementReason;
  normalizedStatus: string;
  validUntil: Date | null;
  instagramConnected: boolean;
}

export interface McpEntitlementUserLike {
  planStatus?: unknown;
  cancelAtPeriodEnd?: unknown;
  currentPeriodEnd?: unknown;
  isInstagramConnected?: unknown;
  instagramAccountId?: unknown;
}

function asValidDate(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value as string);
  return Number.isFinite(date.getTime()) ? date : null;
}

function normalizeSubscriptionStatus(value: unknown): string {
  if (value == null) return "";
  const normalized = String(value).trim().toLowerCase().replace(/[\s-]+/g, "_").replace(/_+/g, "_");
  return normalized === "nonrenewing" ? "non_renewing" : normalized;
}

export function evaluateMcpEntitlement(
  user: McpEntitlementUserLike | null,
  now = new Date(),
): McpEntitlement {
  if (!user) {
    return {
      eligible: false,
      reason: "user_not_found",
      normalizedStatus: "",
      validUntil: null,
      instagramConnected: false,
    };
  }

  const normalizedStatus = normalizeSubscriptionStatus(user.planStatus);
  const validUntil = asValidDate(user.currentPeriodEnd);
  const instagramConnected = Boolean(user.isInstagramConnected && user.instagramAccountId);

  if (normalizedStatus === "active") {
    if (Boolean(user.cancelAtPeriodEnd) && validUntil && validUntil.getTime() <= now.getTime()) {
      return {
        eligible: false,
        reason: "subscription_expired",
        normalizedStatus,
        validUntil,
        instagramConnected,
      };
    }
    return {
      eligible: true,
      reason: "active",
      normalizedStatus,
      validUntil,
      instagramConnected,
    };
  }

  if (normalizedStatus === "non_renewing") {
    const eligible = Boolean(validUntil && validUntil.getTime() > now.getTime());
    return {
      eligible,
      reason: eligible ? "non_renewing" : "subscription_expired",
      normalizedStatus,
      validUntil,
      instagramConnected,
    };
  }

  return {
    eligible: false,
    reason: "subscription_required",
    normalizedStatus,
    validUntil,
    instagramConnected,
  };
}

export async function getMcpEntitlement(userId: string): Promise<McpEntitlement> {
  if (!mongoose.isValidObjectId(userId)) {
    return {
      eligible: false,
      reason: "invalid_identity",
      normalizedStatus: "",
      validUntil: null,
      instagramConnected: false,
    };
  }

  try {
    await connectToDatabase();
    const user = await UserModel.findById(userId)
      .select(
        "planStatus cancelAtPeriodEnd currentPeriodEnd isInstagramConnected instagramAccountId",
      )
      .lean();
    return evaluateMcpEntitlement(user as McpEntitlementUserLike | null);
  } catch {
    return {
      eligible: false,
      reason: "entitlement_unavailable",
      normalizedStatus: "",
      validUntil: null,
      instagramConnected: false,
    };
  }
}
