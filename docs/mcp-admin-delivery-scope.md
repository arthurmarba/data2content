# Escopo de entrega — MCP Administrativo

Esta entrega deve permanecer isolada na branch `codex/mcp-admin-hardening`.
O repositório contém outras alterações em andamento; por isso, somente os
arquivos e trechos listados abaixo pertencem ao MCP.

## Arquivos exclusivos

- `docs/mcp-data2content.md`
- `docs/mcp-admin-delivery-scope.md`
- `scripts/generateMcpOAuthKey.mjs`
- `scripts/smokeMcpOAuthCrypto.ts`
- `src/app/.well-known/oauth-authorization-server/route.ts`
- `src/app/.well-known/oauth-protected-resource/route.ts`
- `src/app/.well-known/oauth-protected-resource/mcp-admin/route.ts`
- `src/app/api/mcp/**`
- `src/app/lib/mcp/**`
- `src/app/lib/dataService/demographicService.ts` (pseudonimização de logs acionados pelo MCP)
- `src/utils/rateLimit.ts` (modo estrito fail-closed usado pelo MCP administrativo)
- `src/app/mcp/authorize/page.tsx`
- `src/app/models/McpAdminAuditEvent.ts`
- `src/app/models/McpOAuthAuthorizationCode.ts`
- `src/app/models/McpOAuthClient.ts`
- `src/app/models/McpOAuthConsentRequest.ts`
- `src/app/models/McpOAuthRefreshToken.ts`
- `tsconfig.mcp.json`

## Arquivos compartilhados — somente hunks MCP

### `.env.example`

Somente o bloco iniciado por `# Data2Content MCP (ChatGPT / Claude)`.

### `package.json`

Somente:

- scripts `typecheck:mcp`, `test:mcp`, `eval:mcp`, `mcp:generate-key`,
  `smoke:mcp-oauth`, `smoke:mcp-admin-integration` e `smoke:mcp-admin-http`;
- dependência `@modelcontextprotocol/sdk`;
- pin de `zod-to-json-schema` necessário para a compatibilidade do SDK.

A alteração do engine Node e os demais scripts não pertencem a esta entrega.

### `package-lock.json`

Somente as alterações derivadas dos itens MCP de `package.json`. Antes do
commit, o lockfile deve ser reconstruído a partir de uma cópia limpa mais os
hunks MCP, evitando incorporar alterações paralelas do manifesto.

## Regra de verificação

Antes de cada commit:

1. confirmar que a branch atual é `codex/mcp-admin-hardening`;
2. revisar `git diff --cached --name-status`;
3. revisar separadamente os hunks staged de `.env.example`, `package.json` e
   `package-lock.json`;
4. não incluir arquivos fora deste documento sem atualizar explicitamente o
   escopo.
