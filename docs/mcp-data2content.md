# MCP Data2Content — implementação inicial

## Objetivo

Disponibilizar dados e ações seguras da conta Data2Content em clientes MCP como ChatGPT e Claude. O servidor é remoto, usa Streamable HTTP e separa explicitamente leitura, geração e escrita.

## Política de acesso

- Apenas assinantes com plano `active` ou `non_renewing` ainda dentro do período pago acessam o MCP.
- A assinatura é verificada no banco em toda requisição do MCP de assinantes, sem cache de sessão e sem bypass administrativo nesse recurso.
- Trial, pagamento pendente, conta inativa ou assinatura expirada são bloqueados.
- Instagram não é requisito para conectar o MCP.
- Ferramentas de métricas exigem Instagram conectado e retornam o caminho de conexão quando necessário.
- As ferramentas nunca recebem `userId`; o usuário vem exclusivamente do access token validado.
- O MCP administrativo usa outro recurso OAuth, exige `role=admin` em todas as chamadas e nunca é aceito pelo endpoint dos assinantes.

## MCP administrativo

O endpoint `GET|POST|DELETE /api/mcp/admin` é um recurso OAuth separado, somente leitura e protegido pela flag `MCP_ADMIN_ENABLED`. Ele permite que um administrador selecione qualquer creator cadastrado e consulte apenas os dados disponibilizados pelas ferramentas.

- Resource Metadata: `GET /.well-known/oauth-protected-resource/mcp-admin`.
- Audience: a URL exata de `MCP_ADMIN_SERVER_URL`.
- A assinatura do administrador não é consultada; a autorização vem de `role=admin`.
- O papel é revalidado no consentimento, emissão, refresh e em toda requisição MCP.
- `MCP_ADMIN_ALLOWED_USER_IDS` permite rollout inicial por allowlist, sem substituir a checagem de papel.
- Cada chamada cria auditoria com administrador, creator alvo, ferramenta, período solicitado, scopes, duração, resultado e request ID.
- Tokens do Instagram, email e outros segredos não entram nos resultados nem nos logs.

Ferramentas administrativas:

- `search`: localiza creators por nome, @username, email ou ID e retorna `creator:<ObjectId>`.
- `fetch`: confirma o creator e informa conexão, cobertura histórica e última atualização.
- `analyze_creator_period`: contagem exata e evidências em um intervalo civil explícito.
- `get_creator_contents`: lista as evidências cronológicas de um intervalo civil explícito, com limite e aviso de truncamento.
- `get_creator_intelligence`: voz, roteiros, ganchos, assuntos, cenas, objetos, enquadramentos e confiança.
- `get_creator_content_details`: análise profunda de um conteúdo que pertença ao creator selecionado.
- `get_creator_audience`: demografia exclusivamente agregada.
- `list_creator_top_content`: ranking por uma métrica armazenada explícita.
- `research_creator_inspirations`: referências opt-in da comunidade para o creator selecionado.
- `compare_creators`: comparação de dois a cinco creators com período e cobertura equivalentes.

Todas as ferramentas têm `readOnlyHint=true`. O servidor instrui o cliente a usar `search` e `fetch` antes da análise, não misturar creators, não estimar contagens e respeitar os recibos de cobertura.

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
- Quinze ferramentas, sendo treze de leitura, uma de geração sem persistência e uma escrita idempotente:
  - `search`
  - `fetch`
  - `get_creator_profile`
  - `analyze_creator_period`
  - `get_creator_intelligence_snapshot`
  - `get_content_deep_analysis`
  - `research_inspiration_content`
  - `analyze_inspiration_content`
  - `compare_inspiration_contents`
  - `generate_script_draft`
  - `save_script`
  - `recommend_collab_creators`
  - `get_performance_summary`
  - `list_top_content`
  - `compare_content_formats`

`search` e `fetch` seguem o contrato de company knowledge usado pelo ChatGPT. As consultas são sempre filtradas pelo usuário autenticado.

### Contagens e períodos confiáveis

`analyze_creator_period` deve ser usada sempre que a pergunta envolver quantidade de publicações, frequência, "última semana", "último mês" ou qualquer intervalo de datas.

- `startDate` e `endDate` são dias civis inclusivos em `YYYY-MM-DD`.
- `timeZone` define o fuso IANA usado para converter esses dias em uma janela UTC exata.
- A contagem usa todos os documentos do período; `evidenceLimit` limita apenas a lista detalhada retornada.
- O resultado inclui `structuredContent`, cobertura de métricas/classificações/cenas/transcrições e um recibo com `mustNotEstimate: true`.
- Se a lista de evidências for truncada, a contagem total continua completa e o aviso `evidence_list_truncated` é retornado.
- O período máximo por chamada é de 366 dias.

### Inteligência estratégica e evidência profunda

`get_creator_intelligence_snapshot` reúne, em uma única leitura, DNA de voz, perfil de estilo, categorias vencedoras, exemplos de roteiros vinculados a resultados, timing observado e padrões visuais agregados. Todo sinal inclui cobertura, tamanho da amostra ou aviso de baixa confiança.

`get_content_deep_analysis` abre um post específico da conta autenticada e retorna somente os dados disponíveis: legenda, transcrição, classificações, cenas, objetos, falas, local, enquadramento, estética, duração e métricas. Campos ausentes permanecem ausentes e o recibo define `mustNotInferMissingFields: true`.

### Pesquisa criativa conversacional

`research_inspiration_content` pesquisa somente conteúdos de outros creators que aceitaram participar da comunidade de inspiração e permanecem com Instagram conectado. O próprio creator autenticado é sempre excluído. A ferramenta permite combinar, numa mesma busca:

- assunto ou território;
- formato;
- tom;
- padrão de gancho;
- duração mínima e máxima;
- cenário;
- objetos em cena;
- enquadramento;
- estética;
- conteúdo semelhante ao histórico do assinante;
- desempenho fora da curva ou aceleração observada.

Os modos disponíveis são `similar_to_me`, `viral_reels`, `trending`, `by_topic` e `winning_patterns`. `similar_to_me` exige Instagram conectado porque usa o histórico do próprio assinante. Os demais modos continuam exclusivos para assinantes, mas não exigem Instagram do pesquisador.

“Viral” significa desempenho relativo ao histórico recente do creator de origem. “Trending” exige aceleração calculada com snapshots diários das últimas 72 horas; um post apenas recente não recebe esse rótulo. A tendência representa exclusivamente a comunidade Data2Content.

Cada resultado recebe um ID estável `inspiration:<ObjectId>`. Esse ID pode ser usado em:

- `analyze_inspiration_content`, para aprofundar gancho, tom, narrativa, duração e execução visual;
- `compare_inspiration_contents`, para comparar de duas a cinco referências;
- `generate_script_draft`, para usar padrões das referências na criação de um roteiro personalizado.

As respostas nunca expõem transcrição integral, roteiro integral, vídeo bruto, demografia de terceiros ou métricas privadas exatas. A adaptação deve usar padrões abstratos, atribuição e links públicos, sem copiar frases, personagens ou identidade visual.

### Roteiros personalizados com confirmação

`generate_script_draft` usa o Gemini como provedor principal e combina o briefing com voz, roteiros vencedores, ganchos, assuntos, audiência, demografia, duração, cenas, objetos, cenários, enquadramentos e resultados disponíveis. Opcionalmente recebe até cinco `inspirationContentIds`; nesse caso, injeta somente os padrões derivados das referências opt-in e aplica uma instrução explícita contra cópia. A ferramenta apenas devolve um rascunho e um `clientRequestId`; ela não grava nada.

`save_script` possui o scope separado `scripts:write`, exige `userConfirmed: true` e só deve ser chamada depois que o cliente mostrou o rascunho e recebeu confirmação explícita. O `clientRequestId` torna a gravação idempotente e segura para retry. Tokens legados com `content:write` continuam aceitos durante a migração.

### Recomendações de collab

`recommend_collab_creators` reutiliza o ranking da própria plataforma e considera afinidade temática, performance, alcance, consistência, escala/eficiência de audiência e recência. Cada sugestão traz score de compatibilidade, componentes do score, tamanho de amostra, métricas médias e mídia kit quando disponível. A ferramenta só considera outros criadores ativos com Instagram conectado e sinaliza que recomendação não equivale a consentimento para contato.

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
MCP_SUPPORTED_SCOPES=profile:read,profile:write,metrics:read,strategy:read,content:read,intelligence:read,audience:read,collabs:read,scripts:generate,scripts:write
MCP_CONNECTION_SCOPES=profile:read,profile:write,metrics:read,strategy:read,content:read,intelligence:read,audience:read,collabs:read,scripts:generate,scripts:write

MCP_ADMIN_ENABLED=0
MCP_ADMIN_SERVER_URL=https://data2content.ai/api/mcp/admin
MCP_ADMIN_REQUIRED_SCOPE=admin:creators:search
MCP_ADMIN_SUPPORTED_SCOPES=admin:creators:search,admin:creator:read,admin:content:read,admin:metrics:read,admin:intelligence:read,admin:audience:read,admin:creators:compare
MCP_ADMIN_CONNECTION_SCOPES=admin:creators:search,admin:creator:read,admin:content:read,admin:metrics:read,admin:intelligence:read,admin:audience:read,admin:creators:compare
MCP_ADMIN_ALLOWED_USER_IDS=<ObjectId do administrador durante o rollout>
MCP_ADMIN_AUDIT_RETENTION_DAYS=180

# IA de roteiros: Gemini principal; OpenAI não é consumida sem opt-in.
LLM_PROVIDER_SCRIPTS=gemini
LLM_FALLBACK_SCRIPTS=false
GEMINI_MODEL_SCRIPT=gemini-3.7-flash
GEMINI_MODEL_SCRIPT_JUDGE=gemini-3.5-flash-lite
GEMINI_MODEL_SCRIPT_FALLBACK=gemini-3.6-flash
GEMINI_THINKING_LEVEL_SCRIPTS=low

# Enriquecimento assíncrono do acervo comunitário: Gemini Flash-Lite, sem OpenAI implícita.
LLM_PROVIDER_COMMUNITY=gemini
LLM_FALLBACK_COMMUNITY=false
GEMINI_MODEL_COMMUNITY_SUMMARY=gemini-3.5-flash-lite
```

Para o modo self-hosted, use `MCP_OAUTH_ISSUER=https://data2content.ai`. O authorization server emite um access token com o ID interno do usuário no claim configurado e os scopes aprovados. Nunca habilitar `MCP_DEV_AUTH_BYPASS` em Preview ou Production.

Gere a chave de assinatura uma única vez:

```bash
npm run mcp:generate-key
```

Copie a linha gerada para o gerenciador seguro de variáveis do ambiente. Não grave a chave privada no repositório. Todos os runtimes de produção precisam usar exatamente a mesma chave.

## Endpoints OAuth

- `GET /.well-known/oauth-protected-resource`
- `GET /.well-known/oauth-protected-resource/mcp-admin`
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

Para o MCP administrativo local, configure também `MCP_ADMIN_ENABLED=1`, use um `MCP_DEV_USER_ID` que possua `role=admin` e conecte em `http://localhost:3000/api/mcp/admin`. O bypass local substitui apenas a validação do JWT; a consulta de `role=admin` continua obrigatória.

Antes de subir o servidor, o fluxo OAuth e o banco podem ser verificados com
`npm run smoke:mcp-admin-integration`. O smoke usa uma chave ES256 efêmera,
seleciona um administrador e um creator já existentes sem alterá-los, executa
OAuth com PKCE, valida autorização, refresh e auditoria, e remove todos os registros
OAuth/auditoria criados pelo próprio teste.

Com o runtime local ativo, `npm run smoke:mcp-admin-http` valida o transporte
Streamable HTTP, o catálogo somente leitura, `search`, `fetch`, ausência de
segredos e um gate local de 5 segundos por ferramenta.

Mesmo no bypass local, a regra de assinatura continua consultando o banco e bloqueando não assinantes.

## Qualidade e observabilidade

- Cada chamada de ferramenta registra nome, duração, cliente, conta pseudonimizada e estado de erro; prompts, roteiros, tokens e dados pessoais não entram nesse log.
- O uso do Gemini é atribuído separadamente às tags `scripts_generation` e `scripts_review`, incluindo tokens de entrada, saída e raciocínio quando o SDK disponibiliza esses dados.
- `npm run eval:mcp` executa os mesmos gates para ChatGPT e Claude: período exato sem estimativa, respeito a evidência ausente, rascunho antes de persistência, confirmação explícita para escrita, collab explicável e seleção correta das ferramentas de pesquisa criativa.

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
