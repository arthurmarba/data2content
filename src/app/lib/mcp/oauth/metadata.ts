import { getMcpOAuthIssuer, getMcpOAuthSupportedScopes } from "../config";

export function getMcpOAuthMetadata() {
  const issuer = getMcpOAuthIssuer();
  return {
    issuer,
    authorization_response_iss_parameter_supported: false,
    authorization_endpoint: `${issuer}/api/mcp/oauth/authorize`,
    token_endpoint: `${issuer}/api/mcp/oauth/token`,
    registration_endpoint: `${issuer}/api/mcp/oauth/register`,
    revocation_endpoint: `${issuer}/api/mcp/oauth/revoke`,
    jwks_uri: `${issuer}/api/mcp/oauth/jwks`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: getMcpOAuthSupportedScopes(),
  };
}
