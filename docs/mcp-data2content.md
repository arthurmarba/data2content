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

- `list_creators`: percorre a base inteira em páginas ligadas por `nextCursor`, incluindo contas desconectadas e sem conteúdo. O cursor só vale para o filtro que o originou.
- `analyze_creator_portfolio`: consolida toda a população filtrada no período e compara com uma janela anterior de igual duração. O resumo cobre todos os criadores que casam com o filtro; as linhas por criador são paginadas.
- `get_creator_analysis`: dossiê de um creator — identidade, conexão, mapa canônico, DNA já armazenado e desempenho do período contra a janela anterior. Não reconstrói perfil nem relê vídeo.
- `get_creator_map`: territórios, narrativa, assets, tom e nível de confirmação do creator selecionado.
- `get_creator_follower_growth`: saldo de seguidores por dia da conta do creator selecionado.
- `get_creator_script_evidence`: até três referências privadas do creator, com fala observada, roteiro planejado, origem e métricas, para analisar texto e estrutura.
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

Todas as ferramentas têm `readOnlyHint=true`. O servidor instrui o cliente a usar `search` e `fetch` antes da análise, não misturar creators, não estimar contagens e respeitar os recibos de cobertura. O servidor só é montado para uma autorização `role=admin` cujo ator confere com a identidade do token; cada ferramenta declara os scopes que exige e a auditoria registra também os creators que apareceram na resposta.

### Analisar todos os creators de uma vez

`search` localiza nomes e nunca representa a base. Para falar da população inteira, o cliente usa `analyze_creator_portfolio` — cujo `summary` é completo por construção — e `list_creators` quando precisa enumerar contas uma a uma.

Os recibos dessa consolidação explicitam o que os números não são: alcance somado entre posts não é audiência única; métricas atuais de posts antigos não são um retrato congelado do passado, porque continuam acumulando; ausência de post no banco não comprova ausência de publicação no Instagram; e a prioridade de atenção mede lacuna operacional, não qualidade editorial. Soma e média por métrica trazem `availablePosts` ao lado de `totalPosts`, e o engajamento agregado só usa posts que têm interações e alcance ao mesmo tempo — numerador e denominador nunca vêm de conjuntos diferentes.

Filtros disponíveis: `population` (`creators`, que exclui contas `admin`/`agency`, ou `all_accounts`), `connection`, `query`, `format` e `sortBy`. Nenhum deles muda o significado do resumo: ele sempre cobre exatamente a população filtrada.

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
- Entre as ferramentas disponíveis (lista completa mantida em `server.ts`):
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
  - `get_script_evidence_pack`
  - `critique_script_against_creator_dna`
  - `record_script_feedback`
  - `save_script`
  - `recommend_collab_creators`
  - `get_performance_summary`
  - `get_follower_growth`
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

`get_content_deep_analysis` abre um post específico da conta autenticada e junta `Metric` com `PublishedContentEvidence`. Retorna somente os dados disponíveis: legenda, transcrição, classificações, timeline de cenas, objetos, falas, local, enquadramento, estética, estrutura narrativa, duração e métricas. A transcrição integral, os segmentos e as falas da timeline só são devolvidos com `includeTranscript: true`; sem isso, a ferramenta informa a disponibilidade mas omite o texto falado. Campos ausentes permanecem ausentes e o recibo define `mustNotInferMissingFields: true`.

`analyze_creator_period` calcula cobertura de transcrição e cenas pela evidência multimodal publicada. `Metric.description` é legenda; o campo legado `Metric.text_content` não é fonte de transcrição. A cobertura de transcrição conta **apenas vídeos**: foto e carrossel saem do total e aparecem em `notApplicable`, porque não ter áudio é diferente de não ter sido lido. No lado administrativo, `analyze_creator_portfolio` separa `videos`/`observedTranscripts` de `photosAndCarousels`/`photosAndCarouselsVisuallyRead`, com o aviso `photo_visual_reading_coverage_partial` para o segundo par.

### Seguidores

`get_follower_growth` devolve o saldo de seguidores por dia. O Instagram não informa esse número: o que existe no banco é o total de seguidores no instante de cada leitura de conta (`AccountInsight.followersCount`, gravado a cada sincronização, hoje cerca de três vezes por dia). O saldo diário é a diferença entre o fechamento de um dia e o do anterior, com três consequências que viajam no recibo:

- **É líquido.** Já desconta quem deixou de seguir. Um dia negativo é saldo negativo, não falha de coleta.
- **Dia sem leitura não é dia de saldo zero.** Ele simplesmente não aparece na série, e a variação seguinte declara em `daysCovered` quantos dias cobre. O ganho nunca é dividido entre os dias do buraco.
- **Sem leitura anterior ao período, o primeiro dia fica sem saldo.** Falta referência, o que é diferente de não ter crescido.
- **O dia em curso não fecha.** Quando o período inclui hoje, o último ponto vem com `dayIsComplete: false`, sai de `bestDay`/`worstDay` e da contagem de dias negativos, e aparece em `inProgressDay`. Sem isso, toda manhã o dia de hoje seria eleito o pior da série.

No lado administrativo, `analyze_creator_portfolio` traz o saldo por criador e o da base inteira, e aceita `sortBy: "follower_gain"`. Quando um criador não tem leitura antes da janela, a medição começa na primeira leitura de dentro dela e `measuredFromDate` diz onde — o saldo cobre menos dias, e `creatorsMeasuredFromInsidePeriod` conta quantos estão nessa situação. Criador com uma única leitura no período fica sem saldo: início e fim seriam o mesmo número.

Por conteúdo, `stats.follows` (quantas pessoas passaram a seguir a partir daquele post) aparece em `get_content_deep_analysis` e pode ordenar `list_top_content` / `list_creator_top_content` com `metric: "follows"`. A API entrega esse campo para FEED e Stories; para Reels ele passou a ser pedido junto das demais métricas, com uma salvaguarda: se a API recusar, a leitura repete sem ele e desativa o campo pelo resto da execução, em vez de perder alcance e interações do post inteiro. Valor ausente é ausência de dado, nunca zero seguidores — e saldo de conta não se atribui a um post sem esse campo.

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

`get_script_evidence_pack` prepara referências do próprio criador para o Claude/ChatGPT escrever na conversa. Exige capacidade privada e `content:read`, `metrics:read`, `intelligence:read`. Recebe objetivo, período, formato, duração até 180 segundos e até três `ownContentIds` (IDs privados da própria conta, não inspirações). Entrega transcrições observadas ou roteiros planejados com origem explícita, métricas, padrões, mapa, preferências e limitações. Não chama Gemini nem gerador textual.

Use o `clientRequestId` em `critique_script_against_creator_dna` para revisar contra o mesmo pacote, conservado privadamente por sete dias. O cliente deve escrever o roteiro sem chamar `generate_script_draft` para repetir o trabalho. A crítica separa verificações técnicas de sinais/rubrica de voz; não certifica semelhança ou desempenho.

`generate_script_draft` continua disponível para pedir escrita ao motor D2C, respeitando o provedor textual configurado e sua política de fallback. Usa o mesmo seletor e mantém as referências nas revisões. Opcionalmente recebe até cinco `inspirationContentIds`, apenas como padrões abstratos. Devolve rascunho, recibo de evidências e `clientRequestId`; não cria um roteiro salvo, mas conserva a sessão privada necessária à proveniência. Não confundir `selectedExamples` com `sentExamples`, especialmente no fallback local.

`save_script` possui o scope separado `scripts:write`, exige `userConfirmed: true` e só deve ser chamada depois que o cliente mostrou o rascunho e recebeu confirmação explícita. O `clientRequestId` torna a gravação idempotente e segura para retry. Tokens legados com `content:write` continuam aceitos durante a migração.

O salvamento mantém referências, métricas utilizadas, origem e versões do texto quando há sessão válida; sem sessão, marca proveniência não verificada. `record_script_feedback` registra preferência expressa sobre um roteiro da própria conta. A confirmação de salvamento não autoriza publicar no Instagram.

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

`npm run smoke:mcp-admin-portfolio` roda, somente leitura e sem subir servidor, as
três consultas que varrem a base: o diretório paginado (conferindo que o cursor
cobre a população inteira sem repetir e recusa troca de filtro), a consolidação do
período com seus recortes, e o dossiê individual. Ele mede o tempo de cada consulta
e falha se algum campo privado aparecer na resposta.

Com o runtime local ativo, `npm run smoke:mcp-admin-http` valida o transporte
Streamable HTTP, o catálogo somente leitura, `search`, `fetch`, `list_creators`,
`analyze_creator_portfolio`, ausência de segredos e um gate local de 5 segundos
por ferramenta.

Mesmo no bypass local, a regra de assinatura continua consultando o banco e bloqueando não assinantes.

## Qualidade e observabilidade

- Cada chamada de ferramenta registra nome, duração, cliente, conta pseudonimizada e estado de erro; prompts, roteiros, tokens e dados pessoais não entram nesse log.
- O uso do Gemini é atribuído separadamente às tags `scripts_generation` e `scripts_review`, incluindo tokens de entrada, saída e raciocínio quando o SDK disponibiliza esses dados.
- `npm run eval:mcp` executa os mesmos gates para ChatGPT e Claude: período exato sem estimativa, respeito a evidência ausente, rascunho antes de persistência, confirmação explícita para escrita, collab explicável e seleção correta das ferramentas de pesquisa criativa. No lado administrativo, também garante que uma pergunta sobre a base inteira passe por `analyze_creator_portfolio` em vez de uma busca por nome, e que enumerar creators passe pelo diretório paginado.

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
