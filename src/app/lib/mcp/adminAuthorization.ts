import mongoose from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import UserModel from "@/app/models/User";

export type McpAdminAuthorizationReason =
  | "active_admin"
  | "invalid_identity"
  | "user_not_found"
  | "admin_role_required"
  | "not_allowlisted"
  | "authorization_unavailable";

export interface McpAdminAuthorization {
  authorized: boolean;
  reason: McpAdminAuthorizationReason;
  actorUserId: string;
  role: string | null;
}
export interface McpAdminUserLike {
  _id?: unknown;
  role?: unknown;
}

function adminAllowlist(): Set<string> {
  return new Set(
    (process.env.MCP_ADMIN_ALLOWED_USER_IDS || "")
      .split(/[\s,]+/)
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

export function evaluateMcpAdminAuthorization(
  userId: string,
  user: McpAdminUserLike | null,
  allowlist = adminAllowlist(),
): McpAdminAuthorization {
  if (!mongoose.isValidObjectId(userId)) {
    return { authorized: false, reason: "invalid_identity", actorUserId: userId, role: null };
  }
  if (!user) {
    return { authorized: false, reason: "user_not_found", actorUserId: userId, role: null };
  }

  const role = typeof user.role === "string" ? user.role.trim().toLowerCase() : "";
  if (role !== "admin") {
    return { authorized: false, reason: "admin_role_required", actorUserId: userId, role: role || null };
  }
  if (allowlist.size > 0 && !allowlist.has(userId)) {
    return { authorized: false, reason: "not_allowlisted", actorUserId: userId, role };
  }
  return { authorized: true, reason: "active_admin", actorUserId: userId, role };
}

export async function getMcpAdminAuthorization(userId: string): Promise<McpAdminAuthorization> {
  if (!mongoose.isValidObjectId(userId)) {
    return evaluateMcpAdminAuthorization(userId, null);
  }
  try {
    await connectToDatabase();
    const user = await UserModel.findById(userId).select("_id role").lean();
    return evaluateMcpAdminAuthorization(userId, user as McpAdminUserLike | null);
  } catch {
    return {
      authorized: false,
      reason: "authorization_unavailable",
      actorUserId: userId,
      role: null,
    };
  }
}
