/** @jest-environment node */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/mcp/admin/route";
import { checkRateLimitStrict } from "@/utils/rateLimit";
import { createD2CAdminMcpServer } from "./adminServer";

jest.mock("@/app/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock("@/utils/rateLimit", () => ({ checkRateLimitStrict: jest.fn() }));
jest.mock("./config", () => ({ isMcpAdminEnabled: jest.fn(() => true) }));
jest.mock("./auth", () => ({
  authenticateAdminMcpRequest: jest.fn(async () => ({
    userId: "507f1f77bcf86cd799439011",
    subject: "507f1f77bcf86cd799439011",
    scopes: ["admin:creators:search"],
    issuer: "https://data2content.ai",
    token: "token",
    clientId: "client-test",
  })),
  buildMcpAdminWwwAuthenticateHeader: jest.fn(() => "Bearer"),
  McpAuthError: class McpAuthError extends Error {},
}));
jest.mock("./adminAuthorization", () => ({
  getMcpAdminAuthorization: jest.fn(async () => ({
    authorized: true,
    reason: "active_admin",
    actorUserId: "507f1f77bcf86cd799439011",
    role: "admin",
  })),
}));
jest.mock("./adminServer", () => ({ createD2CAdminMcpServer: jest.fn() }));

const mockRateLimit = checkRateLimitStrict as jest.MockedFunction<typeof checkRateLimitStrict>;
const mockCreateServer = createD2CAdminMcpServer as jest.MockedFunction<
  typeof createD2CAdminMcpServer
>;

describe("MCP admin route security gates", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 503 and does not create the MCP server when Redis is unavailable", async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, remaining: 0, available: false });
    const response = await POST(new NextRequest("https://data2content.ai/api/mcp/admin", {
      method: "POST",
      headers: { authorization: "Bearer token" },
    }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ error: "rate_limit_unavailable" });
    expect(mockCreateServer).not.toHaveBeenCalled();
  });

  it("returns 429 only when the strict limiter is healthy and exhausted", async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, remaining: 0, available: true });
    const response = await POST(new NextRequest("https://data2content.ai/api/mcp/admin", {
      method: "POST",
      headers: { authorization: "Bearer token" },
    }));

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({ error: "rate_limit_exceeded" });
    expect(mockCreateServer).not.toHaveBeenCalled();
  });
});
