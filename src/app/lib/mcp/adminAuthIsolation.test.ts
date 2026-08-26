/** @jest-environment node */

import { jwtVerify } from "jose";
import { authenticateAdminMcpRequest, authenticateMcpRequest, McpAuthError } from "./auth";

const mockJwtVerify = jwtVerify as jest.MockedFunction<typeof jwtVerify>;

describe("MCP subscriber/admin token isolation", () => {
  const userId = "507f1f77bcf86cd799439011";
  const previous = new Map<string, string | undefined>();
  const keys = [
    "MCP_OAUTH_PRIVATE_JWK",
    "MCP_OAUTH_ISSUER",
    "MCP_SERVER_URL",
    "MCP_OAUTH_AUDIENCE",
    "MCP_OAUTH_JWKS_URL",
    "MCP_OAUTH_ALLOWED_ALGORITHMS",
    "MCP_SUPPORTED_SCOPES",
    "MCP_CONNECTION_SCOPES",
    "MCP_ADMIN_SUPPORTED_SCOPES",
    "MCP_ADMIN_CONNECTION_SCOPES",
    "MCP_DEV_AUTH_BYPASS",
  ];

  beforeAll(() => {
    for (const key of keys) previous.set(key, process.env[key]);
    delete process.env.MCP_OAUTH_PRIVATE_JWK;
    process.env.MCP_OAUTH_ISSUER = "https://data2content.ai";
    process.env.MCP_SERVER_URL = "https://data2content.ai/api/mcp";
    process.env.MCP_OAUTH_AUDIENCE = "https://data2content.ai/api/mcp";
    process.env.MCP_OAUTH_JWKS_URL = "https://data2content.ai/api/mcp/oauth/jwks";
    process.env.MCP_OAUTH_ALLOWED_ALGORITHMS = "ES256";
    process.env.MCP_SUPPORTED_SCOPES = "profile:read,metrics:read";
    process.env.MCP_CONNECTION_SCOPES = "profile:read,metrics:read";
    process.env.MCP_ADMIN_SUPPORTED_SCOPES = "admin:creators:search,admin:creator:read";
    process.env.MCP_ADMIN_CONNECTION_SCOPES = "admin:creators:search,admin:creator:read";
    delete process.env.MCP_DEV_AUTH_BYPASS;
  });

  afterAll(() => {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  beforeEach(() => jest.clearAllMocks());

  it("verifies admin tokens against the isolated admin audience", async () => {
    mockJwtVerify.mockResolvedValue({
      payload: {
        sub: userId,
        d2c_user_id: userId,
        scope: "admin:creators:search admin:creator:read",
      },
      protectedHeader: { alg: "ES256" },
    } as never);
    const request = new Request("https://data2content.ai/api/mcp/admin", {
      headers: { authorization: "Bearer admin-token" },
    });

    await expect(authenticateAdminMcpRequest(request)).resolves.toMatchObject({ userId });
    expect(mockJwtVerify).toHaveBeenCalledWith(
      "admin-token",
      expect.anything(),
      expect.objectContaining({ audience: "https://data2content.ai/api/mcp/admin" }),
    );
  });

  it("accepts the baseline admin scope and leaves authorization to each tool", async () => {
    mockJwtVerify.mockResolvedValue({
      payload: {
        sub: userId,
        d2c_user_id: userId,
        scope: "admin:creators:search",
      },
      protectedHeader: { alg: "ES256" },
    } as never);
    const request = new Request("https://data2content.ai/api/mcp/admin", {
      headers: { authorization: "Bearer least-privilege-admin-token" },
    });

    await expect(authenticateAdminMcpRequest(request)).resolves.toMatchObject({
      userId,
      scopes: ["admin:creators:search"],
    });
  });

  it("grants configured admin connection scopes only to the local development bypass", async () => {
    process.env.MCP_DEV_AUTH_BYPASS = "1";
    process.env.MCP_DEV_USER_ID = userId;
    try {
      await expect(authenticateAdminMcpRequest(
        new Request("https://data2content.ai/api/mcp/admin"),
      )).resolves.toMatchObject({
        userId,
        scopes: ["admin:creators:search", "admin:creator:read"],
        issuer: "local-development",
      });
    } finally {
      delete process.env.MCP_DEV_AUTH_BYPASS;
      delete process.env.MCP_DEV_USER_ID;
    }
  });

  it("verifies subscriber tokens against only the subscriber audience", async () => {
    mockJwtVerify.mockResolvedValue({
      payload: {
        sub: userId,
        d2c_user_id: userId,
        scope: "profile:read metrics:read",
      },
      protectedHeader: { alg: "ES256" },
    } as never);
    const request = new Request("https://data2content.ai/api/mcp", {
      headers: { authorization: "Bearer subscriber-token" },
    });

    await expect(authenticateMcpRequest(request)).resolves.toMatchObject({ userId });
    expect(mockJwtVerify).toHaveBeenCalledWith(
      "subscriber-token",
      expect.anything(),
      expect.objectContaining({ audience: "https://data2content.ai/api/mcp" }),
    );
  });

  it("rejects subscriber scopes at the admin endpoint", async () => {
    mockJwtVerify.mockResolvedValue({
      payload: { sub: userId, d2c_user_id: userId, scope: "profile:read metrics:read" },
      protectedHeader: { alg: "ES256" },
    } as never);
    const request = new Request("https://data2content.ai/api/mcp/admin", {
      headers: { authorization: "Bearer wrong-scope-token" },
    });

    await expect(authenticateAdminMcpRequest(request)).rejects.toMatchObject({
      code: "insufficient_scope",
      status: 403,
    } satisfies Partial<McpAuthError>);
  });
});
