import mongoose from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import UserModel from "@/app/models/User";
import {
  evaluateMcpEntitlement,
  type McpEntitlement,
  type McpEntitlementUserLike,
} from "./entitlement";

export type McpAccountStateReason =
  | "ready_free"
  | "ready_pro_without_instagram"
  | "ready_pro_with_instagram"
  | "user_not_found"
  | "invalid_identity"
  | "account_state_unavailable";

export interface McpAccountState {
  accountAvailable: boolean;
  reason: McpAccountStateReason;
  accessLevel: "free" | "pro";
  entitlement: McpEntitlement;
  instagramConnected: boolean;
  creatorNorth: string | null;
  northDeclared: boolean;
  communityInvitePending: boolean;
  capabilities: {
    aggregateCommunityContext: boolean;
    privateCreatorIntelligence: boolean;
    membershipBenefits: boolean;
  };
}

export interface McpAccountStateUserLike extends McpEntitlementUserLike {
  onboardingAnswers?: {
    creatorPurpose?: unknown;
  } | null;
  whatsappGroupLinkOpenedAt?: unknown;
}

function normalizeCreatorNorth(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function unavailableState(
  reason: Extract<McpAccountStateReason, "user_not_found" | "invalid_identity" | "account_state_unavailable">,
): McpAccountState {
  const entitlement = evaluateMcpEntitlement(null);
  return {
    accountAvailable: false,
    reason,
    accessLevel: "free",
    entitlement: {
      ...entitlement,
      reason: reason === "invalid_identity"
        ? "invalid_identity"
        : reason === "account_state_unavailable"
          ? "entitlement_unavailable"
          : "user_not_found",
    },
    instagramConnected: false,
    creatorNorth: null,
    northDeclared: false,
    communityInvitePending: false,
    capabilities: {
      aggregateCommunityContext: false,
      privateCreatorIntelligence: false,
      membershipBenefits: false,
    },
  };
}

export function evaluateMcpAccountState(
  user: McpAccountStateUserLike | null,
  now = new Date(),
): McpAccountState {
  if (!user) return unavailableState("user_not_found");

  const entitlement = evaluateMcpEntitlement(user, now);
  const isPro = entitlement.eligible;
  const instagramConnected = entitlement.instagramConnected;
  const creatorNorth = normalizeCreatorNorth(user.onboardingAnswers?.creatorPurpose);

  return {
    accountAvailable: true,
    reason: isPro
      ? instagramConnected
        ? "ready_pro_with_instagram"
        : "ready_pro_without_instagram"
      : "ready_free",
    accessLevel: isPro ? "pro" : "free",
    entitlement,
    instagramConnected,
    creatorNorth,
    northDeclared: Boolean(creatorNorth),
    communityInvitePending: Boolean(isPro && !user.whatsappGroupLinkOpenedAt),
    capabilities: {
      aggregateCommunityContext: true,
      privateCreatorIntelligence: Boolean(isPro && instagramConnected),
      membershipBenefits: isPro,
    },
  };
}

export async function getMcpAccountState(userId: string): Promise<McpAccountState> {
  if (!mongoose.isValidObjectId(userId)) return unavailableState("invalid_identity");

  try {
    await connectToDatabase();
    const user = await UserModel.findById(userId)
      .select(
        "planStatus cancelAtPeriodEnd currentPeriodEnd isInstagramConnected instagramAccountId " +
        "onboardingAnswers.creatorPurpose whatsappGroupLinkOpenedAt",
      )
      .lean();
    return evaluateMcpAccountState(user as McpAccountStateUserLike | null);
  } catch {
    return unavailableState("account_state_unavailable");
  }
}
