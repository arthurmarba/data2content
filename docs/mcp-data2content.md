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

## Capacidades atuais

- Endpoint MCP: `GET`, `POST` e `DELETE /api/mcp`.
- Health check: `GET /api/mcp/health`.
- Protected Resource Metadata: `GET /.well-known/oauth-protected-resource`.
- Validação JWT por issuer, audience, JWKS, algoritmo e scopes.
- Authorization server OAuth 2.1 self-hosted com authorization code e PKCE `S256`.
- Dynamic Client Registration para clientes públicos como ChatGPT e Claude.
- Consentimento explícito ligado à sessão Data2Content.
- Códigos de autorização de uso único e refresh tokens opacos com rotação e revogação.
- Limite de 120 requisições por minuto por usuário quando Redis está disponível.
- Nove ferramentas read-only:
  - `search`
  - `fetch`
  - `get_creator_profile`
  - `get_performance_summary`
  - `list_top_content`
  - `compare_content_formats`
  - `analyze_content_period`: analisa uma janela móvel de 7 a 365 dias e compara com o período anterior equivalente.
  - `get_content_detail`: retorna métricas, classificação, gancho, assunto e evidências visuais de um post.
  - `get_data_coverage`: informa cobertura e frescor para o cliente não inventar sinais ausentes.

`search` e `fetch` seguem o contrato de company knowledge usado pelo ChatGPT. As consultas são sempre filtradas pelo usuário autenticado.

`analyze_content_period` compara distribuição, atenção, intenção e conversão. A leitura diferencia exemplo (1 post), indicação (2), sinal (3–4) e padrão (5+), e só cria recomendações ligadas às evidências retornadas. Reels usam duração, watch time, retenção, primeira fala e título de abertura; fotos e carrosséis usam imagens e slides em ordem, inclusive o texto da primeira tela.

## IA e recuperação dos dados

- A classificação de legenda é Gemini-first (`gemini-2.5-flash-lite` por padrão).
- Se o Gemini falhar e houver uma chave OpenAI válida, o núcleo pode usar OpenAI como fallback.
- A leitura multimodal de Reel, foto e carrossel usa Gemini.
- Um cron a cada seis horas reenfileira classificações adiadas, completa leituras multimodais e vincula diagnósticos pré-publicação ao resultado publicado.
- O cron atende apenas assinantes ativos ou `non_renewing` ainda dentro do período pago, com Instagram conectado.
- O request MCP não chama IA: ele lê inteligência materializada, reduzindo latência e custo.

## Scopes e reautorização

O desafio inicial `WWW-Authenticate` anuncia todos os scopes suportados. Se um cliente tiver autorizado apenas parte deles, uma chamada a tool protegida recebe HTTP 403 `insufficient_scope` com o scope necessário, permitindo OAuth step-up.

- `profile:read`: perfil do creator.
- `metrics:read`: métricas, ranking e cobertura.
- `strategy:read`: análise e recomendações estratégicas.
- `content:read`: posts, roteiros e detalhe do conteúdo.

Conexões criadas antes da versão 0.2 podem ter somente `profile:read`. Nesse caso, remova e conecte novamente o Data2Content no Claude ou ChatGPT para aprovar o conjunto novo de permissões.

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

Pipeline de inteligência:

```dotenv
LLM_PROVIDER_CLASSIFICATION=gemini
GEMINI_CLASSIFICATION_MODEL=gemini-2.5-flash-lite
INTELLIGENCE_RECOVERY_CLASSIFICATION_LIMIT=100
INTELLIGENCE_RECOVERY_SCENE_LIMIT=40
INTELLIGENCE_RECOVERY_REQUEUE_HOURS=6
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

## Publicação e validação

Após configurar o ambiente:

1. Publicar a URL MCP com HTTPS.
2. Confirmar os dois documentos `/.well-known` e o JWKS em produção.
3. Cadastrar `https://data2content.ai/api/mcp` como conector no ChatGPT e no Claude usando DCR, ou reconectar para atualizar scopes.
4. Testar assinante com e sem Instagram.
5. Testar não assinante, assinatura expirada, revogação e isolamento entre contas.
6. Pedir “analise meus conteúdos no último mês” e confirmar uma única chamada a `analyze_content_period`, seguida de `get_content_detail` apenas para aprofundar um post.

## Referências oficiais

- OpenAI: https://developers.openai.com/plugins/build/mcp-server
- MCP Authorization: https://modelcontextprotocol.io/specification/latest/basic/authorization
- Claude custom connectors: https://support.anthropic.com/en/articles/11175166-about-custom-integrations-using-remote-mcp
