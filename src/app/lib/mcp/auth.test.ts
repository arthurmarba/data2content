import {
  McpAuthError,
  buildMcpWwwAuthenticateHeader,
  normalizeMcpScopes,
  resolveMcpUserIdFromClaims,
} from "./auth";

describe("MCP OAuth claims", () => {
  const userId = "507f1f77bcf86cd799439011";

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

  it("advertises resource metadata and all supported scopes on initial authorization", () => {
    const header = buildMcpWwwAuthenticateHeader(new McpAuthError("missing_token", 401, "missing"));
    expect(header).toContain('resource_metadata="');
    expect(header).toContain(
      'scope="profile:read metrics:read strategy:read content:read intelligence:read audience:read collabs:read scripts:generate scripts:write"',
    );
    expect(header).toContain('error="invalid_token"');
  });

  it("advertises a step-up scope set for insufficient permissions", () => {
    const header = buildMcpWwwAuthenticateHeader(
      new McpAuthError("insufficient_scope", 403, "missing", ["profile:read", "metrics:read"]),
    );
    expect(header).toContain('scope="profile:read metrics:read"');
    expect(header).toContain('error="insufficient_scope"');
  });
});
