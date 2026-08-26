import {
  McpOAuthError,
  assertExactResource,
  isScopeSubset,
  parseOAuthClientScopes,
  parseOAuthScopes,
  parseOAuthScopesForResource,
  assertMcpResource,
  validatePkceChallenge,
  validatePkceVerifier,
  validateRedirectUri,
} from "./validation";

describe("MCP OAuth validation", () => {
  const originalScopes = process.env.MCP_SUPPORTED_SCOPES;
  const originalAdminScopes = process.env.MCP_ADMIN_SUPPORTED_SCOPES;
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  beforeEach(() => {
    process.env.MCP_SUPPORTED_SCOPES = "profile:read,metrics:read,content:read";
    process.env.MCP_ADMIN_SUPPORTED_SCOPES =
      "admin:creators:search,admin:creator:read,admin:metrics:read";
    process.env.NEXT_PUBLIC_APP_URL = "https://data2content.ai";
  });

  afterAll(() => {
    if (originalScopes === undefined) delete process.env.MCP_SUPPORTED_SCOPES;
    else process.env.MCP_SUPPORTED_SCOPES = originalScopes;
    if (originalAdminScopes === undefined) delete process.env.MCP_ADMIN_SUPPORTED_SCOPES;
    else process.env.MCP_ADMIN_SUPPORTED_SCOPES = originalAdminScopes;
    if (originalAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  });

  it("accepts HTTPS and local loopback redirect URIs", () => {
    expect(validateRedirectUri("https://chatgpt.com/oauth/callback")).toBe("https://chatgpt.com/oauth/callback");
    expect(validateRedirectUri("http://127.0.0.1:9876/callback")).toBe("http://127.0.0.1:9876/callback");
  });

  it.each([
    "http://example.com/callback",
    "https://user:pass@example.com/callback",
    "https://example.com/callback#fragment",
    "not-a-url",
  ])("rejects unsafe redirect URI %s", (redirectUri) => {
    expect(() => validateRedirectUri(redirectUri)).toThrow(McpOAuthError);
  });

  it("requires PKCE S256 with valid challenge and verifier", () => {
    const value = "A".repeat(43);
    expect(validatePkceChallenge(value, "S256")).toBe(value);
    expect(validatePkceVerifier(value)).toBe(value);
    expect(() => validatePkceChallenge(value, "plain")).toThrow("PKCE S256 é obrigatório");
    expect(() => validatePkceVerifier("short")).toThrow("code_verifier inválido");
  });

  it("defaults to supported scopes and rejects unsupported scopes", () => {
    expect(parseOAuthScopes(null)).toEqual(["profile:read", "metrics:read", "content:read"]);
    expect(parseOAuthScopes("profile:read content:read")).toEqual(["profile:read", "content:read"]);
    expect(() => parseOAuthScopes("profile:read admin:write")).toThrow("não são suportados");
  });

  it("requires the baseline profile scope", () => {
    expect(() => parseOAuthScopes("metrics:read")).toThrow("profile:read é obrigatório");
  });

  it("separates subscriber and administrator scope bundles by resource", () => {
    const adminResource = "https://data2content.ai/api/mcp/admin";
    expect(parseOAuthScopesForResource(null, adminResource)).toEqual([
      "admin:creators:search",
      "admin:creator:read",
      "admin:metrics:read",
    ]);
    expect(() => parseOAuthScopesForResource("profile:read", adminResource)).toThrow(
      "não pertencem ao recurso MCP solicitado",
    );
    expect(() =>
      parseOAuthScopesForResource("admin:creators:search", "https://data2content.ai/api/mcp"),
    ).toThrow("não pertencem ao recurso MCP solicitado");
  });

  it("allows dynamic clients to register explicit admin scopes without granting them to subscriber tokens", () => {
    expect(parseOAuthClientScopes("admin:creators:search admin:creator:read")).toEqual([
      "admin:creators:search",
      "admin:creator:read",
    ]);
    expect(parseOAuthClientScopes(null)).toEqual(["profile:read", "metrics:read", "content:read"]);
  });

  it("accepts only the two exact MCP protected resources", () => {
    expect(assertMcpResource("https://data2content.ai/api/mcp")).toBe("https://data2content.ai/api/mcp");
    expect(assertMcpResource("https://data2content.ai/api/mcp/admin")).toBe(
      "https://data2content.ai/api/mcp/admin",
    );
    expect(() => assertMcpResource("https://data2content.ai/api/admin")).toThrow("resource diferente");
  });

  it("compares resource identifiers exactly", () => {
    expect(assertExactResource("https://data2content.ai/api/mcp", "https://data2content.ai/api/mcp"))
      .toBe("https://data2content.ai/api/mcp");
    expect(() => assertExactResource("https://data2content.ai", "https://data2content.ai/api/mcp"))
      .toThrow("resource ausente ou diferente");
  });

  it("does not allow a refresh to expand scopes", () => {
    expect(isScopeSubset(["profile:read"], ["profile:read", "metrics:read"])).toBe(true);
    expect(isScopeSubset(["profile:read", "content:read"], ["profile:read"])).toBe(false);
  });
});
