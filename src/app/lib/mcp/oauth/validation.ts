import { getMcpRequiredScope, getMcpSupportedScopes } from "../config";

const PKCE_CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43,128}$/;
const PKCE_VERIFIER_PATTERN = /^[A-Za-z0-9._~-]{43,128}$/;

export class McpOAuthError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "McpOAuthError";
  }
}

export function parseOAuthScopes(value: unknown, useDefault = true): string[] {
  const supported = new Set(getMcpSupportedScopes());
  const requested = typeof value === "string"
    ? value.split(/\s+/).map((scope) => scope.trim()).filter(Boolean)
    : [];
  const scopes = requested.length > 0 ? [...new Set(requested)] : useDefault ? [...supported] : [];
  if (scopes.some((scope) => !supported.has(scope))) {
    throw new McpOAuthError("invalid_scope", 400, "Um ou mais scopes solicitados não são suportados.");
  }
  const requiredScope = getMcpRequiredScope();
  if (!scopes.includes(requiredScope)) {
    throw new McpOAuthError("invalid_scope", 400, `O scope ${requiredScope} é obrigatório.`);
  }
  return scopes;
}

export function validateRedirectUri(value: unknown): string {
  if (typeof value !== "string" || value.length > 2048) {
    throw new McpOAuthError("invalid_redirect_uri", 400, "redirect_uri inválida.");
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new McpOAuthError("invalid_redirect_uri", 400, "redirect_uri deve ser uma URL absoluta.");
  }
  if (parsed.hash || parsed.username || parsed.password) {
    throw new McpOAuthError("invalid_redirect_uri", 400, "redirect_uri contém componentes não permitidos.");
  }
  const loopback = parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost" || parsed.hostname === "::1";
  if (parsed.protocol !== "https:" && !(loopback && parsed.protocol === "http:")) {
    throw new McpOAuthError("invalid_redirect_uri", 400, "redirect_uri deve usar HTTPS.");
  }
  return parsed.toString();
}

export function validatePkceChallenge(value: unknown, method: unknown): string {
  if (method !== "S256" || typeof value !== "string" || !PKCE_CHALLENGE_PATTERN.test(value)) {
    throw new McpOAuthError("invalid_request", 400, "PKCE S256 é obrigatório.");
  }
  return value;
}

export function validatePkceVerifier(value: unknown): string {
  if (typeof value !== "string" || !PKCE_VERIFIER_PATTERN.test(value)) {
    throw new McpOAuthError("invalid_grant", 400, "code_verifier inválido.");
  }
  return value;
}

export function assertExactResource(received: unknown, expected: string): string {
  if (typeof received !== "string" || received !== expected) {
    throw new McpOAuthError("invalid_target", 400, "resource ausente ou diferente do MCP Data2Content.");
  }
  return received;
}

export function isScopeSubset(requested: string[], granted: string[]): boolean {
  const grantedSet = new Set(granted);
  return requested.every((scope) => grantedSet.has(scope));
}
