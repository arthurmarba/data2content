const DEFAULT_MCP_SCOPES = [
  "profile:read",
  "metrics:read",
  "strategy:read",
  "content:read",
  "intelligence:read",
  "audience:read",
  "collabs:read",
  "scripts:generate",
  "scripts:write",
] as const;

const DEFAULT_MCP_ADMIN_SCOPES = [
  "admin:creators:search",
  "admin:creator:read",
  "admin:content:read",
  "admin:metrics:read",
  "admin:intelligence:read",
  "admin:audience:read",
  "admin:creators:compare",
] as const;

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function requireAbsoluteUrl(name: string, value: string | undefined): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`${name} não configurado.`);
  }

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error(`${name} deve ser uma URL absoluta.`);
  }

  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
    throw new Error(`${name} deve usar HTTPS em produção.`);
  }

  return trimTrailingSlash(parsed.toString());
}

export function getMcpServerUrl(): string {
  const configured = process.env.MCP_SERVER_URL?.trim();
  if (configured) return requireAbsoluteUrl("MCP_SERVER_URL", configured);

  const base =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    "http://localhost:3000";

  return `${trimTrailingSlash(requireAbsoluteUrl("NEXT_PUBLIC_APP_URL", base))}/api/mcp`;
}

export function getMcpResourceMetadataUrl(): string {
  const base = new URL(getMcpServerUrl());
  return `${base.origin}/.well-known/oauth-protected-resource`;
}

export function getMcpAdminServerUrl(): string {
  const configured = process.env.MCP_ADMIN_SERVER_URL?.trim();
  if (configured) return requireAbsoluteUrl("MCP_ADMIN_SERVER_URL", configured);

  const base = new URL(getMcpServerUrl());
  return `${base.origin}/api/mcp/admin`;
}

export function getMcpAdminResourceMetadataUrl(): string {
  const base = new URL(getMcpAdminServerUrl());
  return `${base.origin}/.well-known/oauth-protected-resource/mcp-admin`;
}

export function getMcpAppBaseUrl(): string {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.NEXTAUTH_URL?.trim();
  if (configured) return trimTrailingSlash(requireAbsoluteUrl("NEXT_PUBLIC_APP_URL", configured));
  return new URL(getMcpServerUrl()).origin;
}

export function getMcpSupportedScopes(): string[] {
  const configured = process.env.MCP_SUPPORTED_SCOPES?.trim();
  if (!configured) return [...DEFAULT_MCP_SCOPES];
  return configured
    .split(/[\s,]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
}

export function getMcpAdminSupportedScopes(): string[] {
  const configured = process.env.MCP_ADMIN_SUPPORTED_SCOPES?.trim();
  if (!configured) return [...DEFAULT_MCP_ADMIN_SCOPES];
  return configured
    .split(/[\s,]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
}

export function getMcpOAuthSupportedScopes(): string[] {
  return [...new Set([...getMcpSupportedScopes(), ...getMcpAdminSupportedScopes()])];
}

export function getMcpRequiredScope(): string {
  return process.env.MCP_REQUIRED_SCOPE?.trim() || "profile:read";
}

export function getMcpConnectionScopes(): string[] {
  const supported = getMcpSupportedScopes();
  const configured = process.env.MCP_CONNECTION_SCOPES?.trim();
  if (!configured) return supported;

  const requested = [...new Set(
    configured.split(/[\s,]+/).map((scope) => scope.trim()).filter(Boolean),
  )];
  const unsupported = requested.filter((scope) => !supported.includes(scope));
  if (unsupported.length) {
    throw new Error(`MCP_CONNECTION_SCOPES contém scopes não suportados: ${unsupported.join(", ")}.`);
  }
  const baseline = getMcpRequiredScope();
  if (!requested.includes(baseline)) {
    throw new Error(`MCP_CONNECTION_SCOPES deve incluir o scope obrigatório ${baseline}.`);
  }
  return requested;
}

export function getMcpAdminRequiredScope(): string {
  return process.env.MCP_ADMIN_REQUIRED_SCOPE?.trim() || "admin:creators:search";
}

export function getMcpAdminConnectionScopes(): string[] {
  const supported = getMcpAdminSupportedScopes();
  const configured = process.env.MCP_ADMIN_CONNECTION_SCOPES?.trim();
  if (!configured) return supported;

  const requested = [...new Set(
    configured.split(/[\s,]+/).map((scope) => scope.trim()).filter(Boolean),
  )];
  const unsupported = requested.filter((scope) => !supported.includes(scope));
  if (unsupported.length) {
    throw new Error(`MCP_ADMIN_CONNECTION_SCOPES contém scopes não suportados: ${unsupported.join(", ")}.`);
  }
  const baseline = getMcpAdminRequiredScope();
  if (!requested.includes(baseline)) {
    throw new Error(`MCP_ADMIN_CONNECTION_SCOPES deve incluir o scope obrigatório ${baseline}.`);
  }
  return requested;
}

export function isMcpAdminResource(resource: string): boolean {
  return resource === getMcpAdminServerUrl();
}

export function isMcpAdminEnabled(): boolean {
  return process.env.MCP_ADMIN_ENABLED?.trim() === "1";
}

export function getMcpOAuthIssuer(): string {
  const configured = process.env.MCP_OAUTH_ISSUER?.trim();
  return trimTrailingSlash(
    requireAbsoluteUrl("MCP_OAUTH_ISSUER", configured || getMcpAppBaseUrl()),
  );
}

export function getMcpOAuthAudience(): string {
  const configured = process.env.MCP_OAUTH_AUDIENCE?.trim();
  return requireAbsoluteUrl("MCP_OAUTH_AUDIENCE", configured || getMcpServerUrl());
}

export function getMcpOAuthJwksUrl(): string {
  const configured = process.env.MCP_OAUTH_JWKS_URL?.trim();
  return requireAbsoluteUrl(
    "MCP_OAUTH_JWKS_URL",
    configured || `${getMcpOAuthIssuer()}/api/mcp/oauth/jwks`,
  );
}

export function getMcpOAuthAccessTokenTtlSeconds(): number {
  const value = Number.parseInt(process.env.MCP_OAUTH_ACCESS_TOKEN_TTL_SECONDS || "900", 10);
  return Math.min(3600, Math.max(300, Number.isFinite(value) ? value : 900));
}

export function getMcpOAuthRefreshTokenTtlDays(): number {
  const value = Number.parseInt(process.env.MCP_OAUTH_REFRESH_TOKEN_TTL_DAYS || "30", 10);
  return Math.min(90, Math.max(1, Number.isFinite(value) ? value : 30));
}

export function getMcpOAuthAuthorizationCodeTtlSeconds(): number {
  const value = Number.parseInt(process.env.MCP_OAUTH_CODE_TTL_SECONDS || "300", 10);
  return Math.min(600, Math.max(60, Number.isFinite(value) ? value : 300));
}

export function getMcpAdminAuditRetentionDays(): number {
  const value = Number.parseInt(process.env.MCP_ADMIN_AUDIT_RETENTION_DAYS || "180", 10);
  return Math.min(365, Math.max(30, Number.isFinite(value) ? value : 180));
}

export function getMcpProfileUrl(): string {
  return `${getMcpAppBaseUrl()}/chatgpt/recursos`;
}

export function getInstagramConnectUrl(): string {
  return `${getMcpAppBaseUrl()}/dashboard/instagram/connect?source=chatgpt&next=chatgpt-plugin`;
}

export function getMcpCommunityJoinUrl(): string {
  return `${getMcpAppBaseUrl()}/api/dashboard/community/pro-join?source=chatgpt`;
}
