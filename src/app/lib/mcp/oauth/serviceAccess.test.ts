/** @jest-environment node */

import { assertMcpOAuthSubjectAccess } from "./service";
import { getMcpAdminAuthorization } from "../adminAuthorization";
import { getMcpAccountState } from "../accountState";

jest.mock("@/app/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock("../adminAuthorization", () => ({ getMcpAdminAuthorization: jest.fn() }));
jest.mock("../accountState", () => ({ getMcpAccountState: jest.fn() }));

const mockAdminAuthorization = getMcpAdminAuthorization as jest.MockedFunction<typeof getMcpAdminAuthorization>;
const mockAccountState = getMcpAccountState as jest.MockedFunction<typeof getMcpAccountState>;

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
    expect(mockAccountState).not.toHaveBeenCalled();
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

  it("allows a free account to connect to the subscriber resource", async () => {
    mockAccountState.mockResolvedValue({
      accountAvailable: true,
      reason: "ready_free",
      accessLevel: "free",
      entitlement: {
        eligible: false,
        reason: "subscription_required",
        normalizedStatus: "inactive",
        validUntil: null,
        instagramConnected: false,
      },
      instagramConnected: false,
      creatorNorth: null,
      northDeclared: false,
      communityInvitePending: false,
      capabilities: {
        aggregateCommunityContext: true,
        privateCreatorIntelligence: false,
        membershipBenefits: false,
      },
    });

    await expect(
      assertMcpOAuthSubjectAccess(userId, "https://data2content.ai/api/mcp", "consent"),
    ).resolves.toBeUndefined();
    expect(mockAdminAuthorization).not.toHaveBeenCalled();
  });

  it("rejects an account that cannot be resolved", async () => {
    mockAccountState.mockResolvedValue({
      accountAvailable: false,
      reason: "user_not_found",
      accessLevel: "free",
      entitlement: {
        eligible: false,
        reason: "user_not_found",
        normalizedStatus: "",
        validUntil: null,
        instagramConnected: false,
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
    });

    await expect(
      assertMcpOAuthSubjectAccess(userId, "https://data2content.ai/api/mcp", "consent"),
    ).rejects.toMatchObject({ code: "access_denied", status: 403 });
  });
});
