import {
  McpAuthError,
  buildMcpWwwAuthenticateHeader,
  buildMcpAdminWwwAuthenticateHeader,
  normalizeMcpScopes,
  resolveMcpUserIdFromClaims,
} from "./auth";

describe("MCP OAuth claims", () => {
  const userId = "507f1f77bcf86cd799439011";
  const originalSupportedScopes = process.env.MCP_SUPPORTED_SCOPES;
  const originalConnectionScopes = process.env.MCP_CONNECTION_SCOPES;
  const originalAdminScopes = process.env.MCP_ADMIN_SUPPORTED_SCOPES;
  const originalAdminConnectionScopes = process.env.MCP_ADMIN_CONNECTION_SCOPES;
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  beforeEach(() => {
    process.env.MCP_SUPPORTED_SCOPES =
      "profile:read,metrics:read,strategy:read,content:read,intelligence:read,collabs:read,scripts:generate,scripts:write";
    delete process.env.MCP_CONNECTION_SCOPES;
    process.env.MCP_ADMIN_SUPPORTED_SCOPES =
      "admin:creators:search,admin:creator:read,admin:metrics:read";
    delete process.env.MCP_ADMIN_CONNECTION_SCOPES;
    process.env.NEXT_PUBLIC_APP_URL = "https://data2content.ai";
  });

  afterAll(() => {
    if (originalSupportedScopes === undefined) delete process.env.MCP_SUPPORTED_SCOPES;
    else process.env.MCP_SUPPORTED_SCOPES = originalSupportedScopes;
    if (originalConnectionScopes === undefined) delete process.env.MCP_CONNECTION_SCOPES;
    else process.env.MCP_CONNECTION_SCOPES = originalConnectionScopes;
    if (originalAdminScopes === undefined) delete process.env.MCP_ADMIN_SUPPORTED_SCOPES;
    else process.env.MCP_ADMIN_SUPPORTED_SCOPES = originalAdminScopes;
    if (originalAdminConnectionScopes === undefined) delete process.env.MCP_ADMIN_CONNECTION_SCOPES;
    else process.env.MCP_ADMIN_CONNECTION_SCOPES = originalAdminConnectionScopes;
    if (originalAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  });

  it("normalizes space-delimited and array scopes", () => {
    expect(normalizeMcpScopes({ scope: "profile:read metrics:read" })).toEqual([
      "profile:read",
      "metrics:read",
    ]);
    expect(normalizeMcpScopes({ scp: ["content:read", "strategy:read"] })).toEqual([
      "content:read",
      "strategy:read",
    ]);
  });

  it("uses the configured Data2Content user claim", () => {
    expect(resolveMcpUserIdFromClaims({ d2c_user_id: userId, sub: "oauth-subject" })).toBe(userId);
  });

  it("accepts an ObjectId subject as a compatibility fallback", () => {
    expect(resolveMcpUserIdFromClaims({ sub: userId })).toBe(userId);
  });

  it("rejects tokens that are not linked to a Data2Content user", () => {
    expect(() => resolveMcpUserIdFromClaims({ sub: "oauth-subject" })).toThrow(McpAuthError);
  });

  it("advertises resource metadata and the complete connection scope bundle", () => {
    const header = buildMcpWwwAuthenticateHeader(new McpAuthError("missing_token", 401, "missing"));
    expect(header).toContain('resource_metadata="');
    expect(header).toContain(
      'scope="profile:read metrics:read strategy:read content:read intelligence:read collabs:read scripts:generate scripts:write"',
    );
    expect(header).toContain('error="invalid_token"');
  });

  it("advertises an isolated administrative resource and scope bundle", () => {
    const header = buildMcpAdminWwwAuthenticateHeader(
      new McpAuthError("missing_token", 401, "missing"),
    );
    expect(header).toContain(
      'resource_metadata="https://data2content.ai/.well-known/oauth-protected-resource/mcp-admin"',
    );
    expect(header).toContain(
      'scope="admin:creators:search admin:creator:read admin:metrics:read"',
    );
    expect(header).not.toContain("profile:read");
  });
});
