import { evaluateMcpAdminAuthorization } from "./adminAuthorization";

describe("MCP admin authorization", () => {
  const userId = "507f1f77bcf86cd799439011";

  it("authorizes an administrator without requiring a subscription", () => {
    expect(evaluateMcpAdminAuthorization(userId, { role: "admin" }, new Set())).toEqual({
      authorized: true,
      reason: "active_admin",
      actorUserId: userId,
      role: "admin",
    });
  });

  it("rejects a subscriber or regular user even if the identity is valid", () => {
    expect(evaluateMcpAdminAuthorization(userId, { role: "user" }, new Set())).toMatchObject({
      authorized: false,
      reason: "admin_role_required",
    });
  });

  it("enforces the rollout allowlist when configured", () => {
    expect(
      evaluateMcpAdminAuthorization(userId, { role: "admin" }, new Set(["507f1f77bcf86cd799439099"])),
    ).toMatchObject({ authorized: false, reason: "not_allowlisted" });
  });

  it("rejects invalid and missing identities", () => {
    expect(evaluateMcpAdminAuthorization("invalid", { role: "admin" }, new Set())).toMatchObject({
      authorized: false,
      reason: "invalid_identity",
    });
    expect(evaluateMcpAdminAuthorization(userId, null, new Set())).toMatchObject({
      authorized: false,
      reason: "user_not_found",
    });
  });
});
