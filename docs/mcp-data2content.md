# MCP Data2Content — inteligência completa v0.5

## Objetivo

Disponibilizar dados e o motor de roteiros da conta Data2Content em clientes MCP como ChatGPT e Claude. O servidor é remoto e usa Streamable HTTP.

## Política de acesso

- Apenas assinantes com plano `active` ou `non_renewing` ainda dentro do período pago acessam o MCP.
- A assinatura é verificada no banco em toda requisição MCP, sem cache de sessão e sem bypass de administrador.
- Trial, pagamento pendente, conta inativa ou assinatura expirada são bloqueados.
- Instagram não é requisito para concluir o OAuth, mas métricas, DNA e geração personalizada exigem a conexão ativa e retornam o caminho de conexão quando necessário.
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
- Dezoito ferramentas: quinze de leitura/análise, duas de geração/crítica e uma escrita idempotente:
  - `search`
  - `fetch`
  - `get_creator_profile`
  - `get_performance_summary`
  - `list_top_content`
  - `get_creator_intelligence_profile`: mapa narrativo, confirmações e contribuição dos vídeos.
  - `get_video_diagnosis`: leitura multimodal completa, evidências e recomendação estratégica.
  - `get_audience_intelligence`: audiência agregada, demografia e crescimento.
  - `get_creator_playbook`: padrões de uma semana fechada contra uma base histórica separada de 90 dias; não é fonte para contar um período solicitado.
  - `get_creator_content_dna`: voz, estruturas, ganchos, assuntos, duração, cenários, objetos, enquadramentos, audiência agregada e cobertura da evidência.
  - `generate_creator_script`: gera um roteiro integral no motor central Data2Content com recuperação privada dos melhores roteiros/transcrições relacionados ao pedido.
  - `critique_script_against_creator_dna`: avalia duração, qualidade técnica e aderência ao histórico do creator sem salvar nada.
  - `save_generated_script`: salva somente após pedido explícito; nunca publica e deduplica pela chave `clientRequestId`.
  - `suggest_collab_creators`: creators assinantes e explicitamente disponíveis para collab.
  - `compare_content_formats`
  - `analyze_content_period`: fonte autoritativa para contagem e análise de um período semântico ou customizado.
  - `get_content_detail`: retorna métricas, evolução, classificação completa, entidades, gancho, assunto e evidências visuais de um post.
  - `get_data_coverage`: informa cobertura, frescor, manifesto público e camadas restritas/ausentes.

`search` e `fetch` seguem o contrato de company knowledge usado pelo ChatGPT. As consultas são sempre filtradas pelo usuário autenticado.

`analyze_content_period` compara distribuição, atenção, intenção e conversão. A leitura diferencia exemplo (1 post), indicação (2), sinal (3–4) e padrão (5+), e só cria recomendações ligadas às evidências retornadas. Além de assunto, forma e intenção, a v0.4 entrega proposta, tom, referências, sinais de conteúdo, tipo de prova, modo comercial, entidades, assets de vida e cobertura das métricas derivadas/velocidade. Reels usam duração, watch time, retenção, primeira fala e título de abertura; fotos e carrosséis usam imagens e slides em ordem, inclusive o texto da primeira tela.

### Contrato temporal e de contagem v0.4

- `last_closed_week`: “última semana” e “semana passada”; segunda a domingo no fuso `America/Sao_Paulo`.
- `rolling_7_days`: “últimos 7 dias”; sete períodos exatos de 24 horas.
- `current_week`: “esta semana”; segunda-feira até o momento da análise.
- `rolling_30_days`: “últimos 30 dias”.
- `previous_calendar_month`: “mês passado”; mês civil anterior completo.
- `custom`: `startsAt` e `endsAt` em `YYYY-MM-DD` ou ISO 8601.
- `periodDays` continua aceito para clientes antigos e sai identificado como `legacy_rolling_days`.

Somente `inventory.publishedCount` sustenta uma frase sobre frequência de publicação. `collectedCount`, `metricsEligibleCount`, `fullyAnalyzedCount`, `returnedSampleCount`, cobertura e suporte de padrões descrevem outros universos e nunca podem ser convertidos em cadência.

Cada resultado inclui:

- período com rótulo, significado, datas, fuso e natureza móvel/civil;
- inventário conferível com cada publicação contada;
- fato canônico de publicação;
- resumo determinístico seguro;
- cobertura separada da contagem;
- `analysisReceipt` com status `complete`, `partial` ou `inconsistent`;
- regras explícitas de interpretação para Claude e ChatGPT.

O playbook renomeia `postsWeek`, `posts90d`, `nPosts` e `weeklyOccurrences` na saída pública para `publishedInClosedWeek`, `baselinePublishedCount`, `supportingPostsInBaseline` e `occurrencesInClosedWeek`.

O arquivo `src/app/lib/mcp/intelligenceContract.ts` é a allowlist versionada das camadas e dos campos públicos. Dados brutos de provedores, URLs privadas de mídia, prompts internos, o corpus integral de transcrições históricas, e-mail, localização precisa, métricas privadas e evidências privadas de outros creators ficam deliberadamente fora do MCP. Os textos integrais do próprio creator são recuperados dentro da Data2Content e enviados apenas ao modelo de geração, em no máximo três exemplos vencedores relevantes e um contraste.

### Privacidade de collabs

- O solicitante precisa ser assinante para acessar o MCP.
- Um candidato precisa ter plano `active` ou `non_renewing` e consentimento explícito de descoberta.
- Marcar `interested` na plataforma registra esse consentimento; `dismissed` nunca registra.
- O próprio creator pode desligar a descoberta pelo `PATCH` da rota de interesse.
- A IA recebe apenas perfil público, sinais gerais de compatibilidade, modo remoto/presencial e direção de gravação.
- Cidade, e-mail, métricas e evidências privadas do candidato não entram no resultado.

## IA e recuperação dos dados

- A classificação de legenda é Gemini-first (`gemini-2.5-flash-lite` por padrão).
- Se o Gemini falhar e houver uma chave OpenAI válida, o núcleo pode usar OpenAI como fallback.
- A leitura multimodal de Reel, foto e carrossel usa Gemini.
- A geração de roteiros usa Gemini como provedor primário (`GEMINI_SCRIPT_MODEL`) e conserva o gerador OpenAI/local como fallback operacional.
- Cada geração recebe um `evidenceReceipt` com cobertura, quantidade de exemplos integrais usados, demografia disponível e avisos de confiança.
- Uma validação posterior confere duração, filmabilidade, gancho, CTA e cópia literal de oito palavras ou mais; o Gemini faz uma tentativa de reparo quando necessário.
- Um cron a cada seis horas reenfileira classificações adiadas, completa leituras multimodais e vincula diagnósticos pré-publicação ao resultado publicado.
- O cron atende apenas assinantes ativos ou `non_renewing` ainda dentro do período pago, com Instagram conectado.
- As consultas de conteúdo, mapa, diagnóstico, audiência e playbook apenas leem inteligência materializada, reduzindo latência e custo.
- `suggest_collab_creators` pode usar Gemini para redigir uma razão de fit e direção curta; se a chamada falhar, usa um fallback determinístico.

## Scopes e reautorização

O desafio inicial `WWW-Authenticate` anuncia todos os scopes suportados. Se um cliente tiver autorizado apenas parte deles, uma chamada a tool protegida recebe HTTP 403 `insufficient_scope` com o scope necessário, permitindo OAuth step-up.

- `profile:read`: perfil do creator.
- `metrics:read`: métricas, ranking e cobertura.
- `strategy:read`: análise e recomendações estratégicas.
- `content:read`: posts, roteiros e detalhe do conteúdo.
- `intelligence:read`: mapa criativo, diagnóstico multimodal e playbook.
- `audience:read`: insights e demografia agregada da audiência.
- `collabs:read`: sugestões read-only da rede de creators disponíveis.
- `scripts:generate`: geração e crítica personalizadas; implica custo de modelo e exige Instagram conectado.
- `scripts:write`: salvar um roteiro na conta após confirmação explícita; nunca publicar.

Conexões criadas antes da versão 0.5 não terão `scripts:generate` e `scripts:write`. O servidor responde com `insufficient_scope` para o cliente executar OAuth step-up; se o cliente não fizer isso automaticamente, remova e conecte novamente o Data2Content.

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
MCP_SUPPORTED_SCOPES=profile:read,metrics:read,strategy:read,content:read,intelligence:read,audience:read,collabs:read,scripts:generate,scripts:write
MCP_SCRIPT_GENERATION_HOURLY_LIMIT=20
```

Pipeline de inteligência:

```dotenv
LLM_PROVIDER_CLASSIFICATION=gemini
GEMINI_CLASSIFICATION_MODEL=gemini-2.5-flash-lite
SCRIPTS_GENERATION_V3_ENABLED=true
GEMINI_SCRIPT_MODEL=gemini-2.5-flash
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
7. Pedir “o que meus vídeos revelam sobre meu estilo?” e confirmar `get_creator_intelligence_profile` + `get_video_diagnosis`.
8. Pedir “sugira creators para uma collab sobre IA” e verificar que somente candidatos opt-in aparecem, sem dados privados.
9. Pedir “crie um roteiro de 30 segundos sobre IA” e confirmar `generate_creator_script`, duração, validação e `evidenceReceipt`.
10. Pedir “salve este roteiro” e confirmar uma chamada a `save_generated_script`; repetir a mesma chamada e validar `idempotentReplay=true`.

### Casos obrigatórios de confiabilidade

- “última semana” seleciona `last_closed_week` e cita as datas.
- “últimos 7 dias” seleciona `rolling_7_days`.
- “esta semana” seleciona `current_week`.
- “mês passado” seleciona `previous_calendar_month`.
- “últimos 30 dias” seleciona `rolling_30_days`.
- Nenhuma resposta usa cobertura, amostra ou suporte de padrão como quantidade publicada.
- Se `analysisReceipt.status=inconsistent`, a IA não afirma uma contagem sem explicar a divergência.

Os logs guardam somente ferramenta, preset, datas, formato, objetivo, duração e contagem de caracteres, além dos campos sanitizados do `analysisReceipt`. Prompt, roteiro, legendas, buscas, resultados criativos, tokens e segredos não entram no log de auditoria.

## Referências oficiais

- OpenAI: https://developers.openai.com/plugins/build/mcp-server
- MCP Authorization: https://modelcontextprotocol.io/specification/latest/basic/authorization
- Claude custom connectors: https://support.anthropic.com/en/articles/11175166-about-custom-integrations-using-remote-mcp
