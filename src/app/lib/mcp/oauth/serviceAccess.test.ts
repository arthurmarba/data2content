/** @jest-environment node */

import { assertMcpOAuthSubjectAccess } from "./service";
import { getMcpAdminAuthorization } from "../adminAuthorization";
import { getMcpEntitlement } from "../entitlement";

jest.mock("@/app/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock("../adminAuthorization", () => ({ getMcpAdminAuthorization: jest.fn() }));
jest.mock("../entitlement", () => ({ getMcpEntitlement: jest.fn() }));

const mockAdminAuthorization = getMcpAdminAuthorization as jest.MockedFunction<typeof getMcpAdminAuthorization>;
const mockEntitlement = getMcpEntitlement as jest.MockedFunction<typeof getMcpEntitlement>;

describe("MCP OAuth subject access policy", () => {
  const userId = "507f1f77bcf86cd799439011";
  const previousAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  beforeAll(() => {
    process.env.NEXT_PUBLIC_APP_URL = "https://data2content.ai";
  });

  afterAll(() => {
    if (previousAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = previousAppUrl;
  });

  beforeEach(() => jest.clearAllMocks());

  it("uses admin role authorization instead of subscription for the admin resource", async () => {
    mockAdminAuthorization.mockResolvedValue({
      authorized: true,
      reason: "active_admin",
      actorUserId: userId,
      role: "admin",
    });

    await expect(
      assertMcpOAuthSubjectAccess(userId, "https://data2content.ai/api/mcp/admin", "consent"),
    ).resolves.toBeUndefined();
    expect(mockEntitlement).not.toHaveBeenCalled();
  });

  it("rejects a revoked admin during refresh or code exchange", async () => {
    mockAdminAuthorization.mockResolvedValue({
      authorized: false,
      reason: "admin_role_required",
      actorUserId: userId,
      role: "user",
    });

    await expect(
      assertMcpOAuthSubjectAccess(userId, "https://data2content.ai/api/mcp/admin", "grant"),
    ).rejects.toMatchObject({ code: "invalid_grant", status: 400 });
  });

  it("preserves subscription entitlement for the subscriber resource", async () => {
    mockEntitlement.mockResolvedValue({
      eligible: false,
      reason: "subscription_required",
      normalizedStatus: "",
      validUntil: null,
      instagramConnected: false,
    });

    await expect(
      assertMcpOAuthSubjectAccess(userId, "https://data2content.ai/api/mcp", "consent"),
    ).rejects.toMatchObject({ code: "subscription_required", status: 403 });
    expect(mockAdminAuthorization).not.toHaveBeenCalled();
  });
});
