# MCP Data2Content — implementação inicial

## Objetivo

Disponibilizar dados da conta Data2Content em clientes MCP como ChatGPT e Claude. O servidor é remoto, usa Streamable HTTP e começa somente com ferramentas de leitura.

## Política de acesso

- Apenas assinantes com plano `active` ou `non_renewing` ainda dentro do período pago acessam o MCP.
- A assinatura é verificada no banco em toda requisição MCP, sem cache de sessão e sem bypass de administrador.
- Trial, pagamento pendente, conta inativa ou assinatura expirada são bloqueados.
- Instagram não é requisito para conectar o MCP.
- Ferramentas de métricas exigem Instagram conectado e retornam o caminho de conexão quando necessário.
- As ferramentas nunca recebem `userId`; o usuário vem exclusivamente do access token validado.

## Entregue nesta etapa

- Endpoint MCP: `GET`, `POST` e `DELETE /api/mcp`.
- Health check: `GET /api/mcp/health`.
- Protected Resource Metadata: `GET /.well-known/oauth-protected-resource`.
- Validação JWT por issuer, audience, JWKS, algoritmo e scopes.
- Authorization server OAuth 2.1 self-hosted com authorization code e PKCE `S256`.
- Dynamic Client Registration para clientes públicos como ChatGPT e Claude.
- Consentimento explícito ligado à sessão Data2Content.
- Códigos de autorização de uso único e refresh tokens opacos com rotação e revogação.
- Limite de 120 requisições por minuto por usuário quando Redis está disponível.
- Seis ferramentas read-only:
  - `search`
  - `fetch`
  - `get_creator_profile`
  - `get_performance_summary`
  - `list_top_content`
  - `compare_content_formats`

`search` e `fetch` seguem o contrato de company knowledge usado pelo ChatGPT. As consultas são sempre filtradas pelo usuário autenticado.

## Configuração

As variáveis estão documentadas em `.env.example`:

```dotenv
MCP_SERVER_URL=https://data2content.ai/api/mcp
MCP_OAUTH_ISSUER=https://data2content.ai
MCP_OAUTH_AUDIENCE=https://data2content.ai/api/mcp
MCP_OAUTH_JWKS_URL=https://data2content.ai/api/mcp/oauth/jwks
MCP_OAUTH_PRIVATE_JWK=<JWK EC P-256 privada em JSON>
MCP_OAUTH_USER_ID_CLAIM=d2c_user_id
MCP_OAUTH_ALLOWED_ALGORITHMS=ES256
MCP_REQUIRED_SCOPE=profile:read
MCP_SUPPORTED_SCOPES=profile:read,metrics:read,strategy:read,content:read
```

Para o modo self-hosted, use `MCP_OAUTH_ISSUER=https://data2content.ai`. O authorization server emite um access token com o ID interno do usuário no claim configurado e os scopes aprovados. Nunca habilitar `MCP_DEV_AUTH_BYPASS` em Preview ou Production.

Gere a chave de assinatura uma única vez:

```bash
npm run mcp:generate-key
```

Copie a linha gerada para o gerenciador seguro de variáveis do ambiente. Não grave a chave privada no repositório. Todos os runtimes de produção precisam usar exatamente a mesma chave.

## Endpoints OAuth

- `GET /.well-known/oauth-protected-resource`
- `GET /.well-known/oauth-authorization-server`
- `POST /api/mcp/oauth/register`
- `GET|POST /api/mcp/oauth/authorize`
- `POST /api/mcp/oauth/token`
- `POST /api/mcp/oauth/revoke`
- `GET /api/mcp/oauth/jwks`

## Desenvolvimento local

1. Escolha no banco um usuário assinante para testes.
2. Configure `MCP_DEV_AUTH_BYPASS=1` e `MCP_DEV_USER_ID=<ObjectId>` somente no ambiente local.
3. Execute a aplicação normalmente.
4. Valide `GET http://localhost:3000/api/mcp/health`.
5. Configure o MCP Inspector ou outro cliente para `http://localhost:3000/api/mcp`.

Mesmo no bypass local, a regra de assinatura continua consultando o banco e bloqueando não assinantes.

## Etapa necessária para produção

O authorization server já está implementado. Ainda é necessário configurar a chave privada e as URLs canônicas no ambiente de produção, publicar e executar o fluxo real nos clientes.

Após configurar o ambiente:

1. Publicar a URL MCP com HTTPS.
2. Confirmar os dois documentos `/.well-known` e o JWKS em produção.
3. Cadastrar `https://data2content.ai/api/mcp` como conector no ChatGPT e no Claude usando DCR.
4. Testar assinante com e sem Instagram.
5. Testar não assinante, assinatura expirada, revogação e isolamento entre contas.

## Referências oficiais

- OpenAI: https://developers.openai.com/plugins/build/mcp-server
- MCP Authorization: https://modelcontextprotocol.io/specification/latest/basic/authorization
- Claude custom connectors: https://support.anthropic.com/en/articles/11175166-about-custom-integrations-using-remote-mcp
