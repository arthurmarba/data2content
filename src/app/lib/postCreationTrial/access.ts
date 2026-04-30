import type { Session } from "next-auth";
import { Types } from "mongoose";

import { connectToDatabase } from "@/app/lib/mongoose";
import { ensurePlannerAccess } from "@/app/lib/planGuard";
import UserModel, { type AccountState, type IPostCreationTrial } from "@/app/models/User";
import { isPlanActiveLike, normalizePlanStatus } from "@/utils/planStatus";

export type SerializedPostCreationTrial = {
  startedAt: string | null;
  analysisUsedAt: string | null;
  pautaUsedAt: string | null;
  firstDraftId: string | null;
  instagramAccountId: string | null;
  completedSignupAt: string | null;
  subscribedAt: string | null;
  source: string | null;
};

export type PostCreationTrialAccess =
  | {
      ok: true;
      userId: string;
      accountState: AccountState;
      trial: SerializedPostCreationTrial;
      instagramConnected: boolean;
      fullAccess: boolean;
    }
  | {
      ok: false;
      status: number;
      error: string;
      reason: string;
    };

function toIso(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value as any);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function serializePostCreationTrial(
  trial?: IPostCreationTrial | null
): SerializedPostCreationTrial {
  return {
    startedAt: toIso(trial?.startedAt),
    analysisUsedAt: toIso(trial?.analysisUsedAt),
    pautaUsedAt: toIso(trial?.pautaUsedAt),
    firstDraftId: trial?.firstDraftId ? String(trial.firstDraftId) : null,
    instagramAccountId:
      typeof trial?.instagramAccountId === "string" && trial.instagramAccountId.trim()
        ? trial.instagramAccountId.trim()
        : null,
    completedSignupAt: toIso(trial?.completedSignupAt),
    subscribedAt: toIso(trial?.subscribedAt),
    source: typeof trial?.source === "string" ? trial.source : null,
  };
}

export function hasFullPostCreationAccess(user: any): boolean {
  const role = typeof user?.role === "string" ? user.role.trim().toLowerCase() : "";
  if (role === "admin") return true;
  return isPlanActiveLike(normalizePlanStatus(user?.planStatus));
}

export function isTrialAccountState(value: unknown): value is "pre_signup" | "registered" {
  return value === "pre_signup" || value === "registered";
}

export async function getPostCreationTrialAccess(
  userId?: string | null
): Promise<PostCreationTrialAccess> {
  if (!userId || !Types.ObjectId.isValid(userId)) {
    return {
      ok: false,
      status: 401,
      error: "Usuário autenticado inválido.",
      reason: "unauthenticated",
    };
  }

  await connectToDatabase();
  const user = await UserModel.findById(userId)
    .select("accountState postCreationTrial isInstagramConnected planStatus role")
    .exec();

  if (!user) {
    return {
      ok: false,
      status: 404,
      error: "Usuário não encontrado.",
      reason: "user_not_found",
    };
  }

  if (hasFullPostCreationAccess(user)) {
    return {
      ok: true,
      userId,
      accountState: (user.accountState ?? "registered") as AccountState,
      trial: serializePostCreationTrial(user.postCreationTrial),
      instagramConnected: Boolean(user.isInstagramConnected),
      fullAccess: true,
    };
  }

  const accountState = user.accountState ?? "registered";
  if (!isTrialAccountState(accountState) || !user.postCreationTrial?.startedAt) {
    return {
      ok: false,
      status: 403,
      error: "Assine para continuar usando o board de criação.",
      reason: "post_creation_subscription_required",
    };
  }

  return {
    ok: true,
    userId,
    accountState,
    trial: serializePostCreationTrial(user.postCreationTrial),
    instagramConnected: Boolean(user.isInstagramConnected),
    fullAccess: false,
  };
}

export async function validatePostCreationBoardAccess(params: {
  request: Request;
  session: Session;
}): Promise<{ ok: true } | { ok: false; status: number; error: string; reason?: string }> {
  const { request, session } = params;
  const routePath = new URL(request.url).pathname;
  const plannerAccess = await ensurePlannerAccess({ session, routePath, forceReload: true });
  if (!plannerAccess.ok) {
    return {
      ok: false,
      status: plannerAccess.status,
      error: plannerAccess.message,
      reason: plannerAccess.reason,
    };
  }

  if (hasFullPostCreationAccess(session.user)) {
    return { ok: true };
  }

  const trialAccess = await getPostCreationTrialAccess(session.user?.id);
  if (!trialAccess.ok) {
    return {
      ok: false,
      status: trialAccess.status,
      error: trialAccess.error,
      reason: trialAccess.reason,
    };
  }

  return { ok: true };
}

export async function markPostCreationTrialAnalysisUsed(userId: string) {
  if (!Types.ObjectId.isValid(userId)) return null;
  await connectToDatabase();
  return UserModel.findOneAndUpdate(
    {
      _id: new Types.ObjectId(userId),
      "postCreationTrial.startedAt": { $ne: null },
      "postCreationTrial.analysisUsedAt": { $in: [null, undefined] },
    },
    {
      $set: {
        "postCreationTrial.analysisUsedAt": new Date(),
      },
    },
    { new: true }
  )
    .select("postCreationTrial")
    .lean()
    .exec();
}

export async function markPostCreationTrialInstagramConnected(
  userId: string,
  instagramAccountId: string
) {
  const normalizedInstagramAccountId =
    typeof instagramAccountId === "string" ? instagramAccountId.trim() : "";
  if (!Types.ObjectId.isValid(userId) || !normalizedInstagramAccountId) return null;
  await connectToDatabase();
  return UserModel.findOneAndUpdate(
    {
      _id: new Types.ObjectId(userId),
      "postCreationTrial.startedAt": { $ne: null },
    },
    {
      $set: {
        "postCreationTrial.instagramAccountId": normalizedInstagramAccountId,
      },
    },
    { new: true }
  )
    .select("postCreationTrial")
    .lean()
    .exec();
}

export async function findPostCreationTrialUsageByInstagram(params: {
  instagramAccountId: string;
  excludeUserId?: string | null;
}) {
  const instagramAccountId =
    typeof params.instagramAccountId === "string" ? params.instagramAccountId.trim() : "";
  if (!instagramAccountId) return null;

  const query: Record<string, unknown> = {
    "postCreationTrial.instagramAccountId": instagramAccountId,
    accountState: { $ne: "merged" },
    $or: [
      { "postCreationTrial.analysisUsedAt": { $ne: null } },
      { "postCreationTrial.pautaUsedAt": { $ne: null } },
    ],
  };

  if (params.excludeUserId && Types.ObjectId.isValid(params.excludeUserId)) {
    query._id = { $ne: new Types.ObjectId(params.excludeUserId) };
  }

  await connectToDatabase();
  const user = await UserModel.findOne(query)
    .select("_id accountState postCreationTrial")
    .lean()
    .exec();

  if (!user) return null;
  return {
    userId: String(user._id),
    accountState: user.accountState ?? "registered",
    trial: serializePostCreationTrial(user.postCreationTrial),
  };
}

export async function markPostCreationTrialPautaUsed(userId: string) {
  if (!Types.ObjectId.isValid(userId)) return null;
  await connectToDatabase();
  return UserModel.findOneAndUpdate(
    {
      _id: new Types.ObjectId(userId),
      "postCreationTrial.startedAt": { $ne: null },
      "postCreationTrial.pautaUsedAt": { $in: [null, undefined] },
    },
    {
      $set: {
        "postCreationTrial.pautaUsedAt": new Date(),
      },
    },
    { new: true }
  )
    .select("postCreationTrial")
    .lean()
    .exec();
}
