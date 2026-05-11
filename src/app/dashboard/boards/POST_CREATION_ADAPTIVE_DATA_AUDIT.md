# V9A - Auditoria de dados reais para StudyContext server-side

Esta auditoria mapeia fontes reais ja existentes no projeto para uma futura fase de `PostCreationAdaptiveStudyContext` server-side. A V9A nao implementa endpoint, query nova, runtime novo, IA ou integracao no board. O objetivo e documentar com precisao o que ja existe, o que e confiavel e quais lacunas precisam ser resolvidas antes da V9B/V9C.

## Resumo executivo

O melhor ponto de partida server-side e o modelo `Metric`. Ele concentra posts reais do Instagram/manual/document_ai, caption em `description`, link/permalink, data, formato, classificacoes legadas, classificacoes V2/V2.5, sinais comerciais/collab e metricas por post. O planner atual ja consome `Metric` para gerar recomendacoes, janelas, temas e posts de evidencia, mas o payload que chega ao client e mais fino do que o dado bruto disponivel no banco.

O segundo grupo forte e o planner: `PlannerPlan`, `PlannerRecCache`, `recommendWeeklySlots`, `getTimeBlockScores`, `getBlockSampleCaptions` e `getThemesForSlot`. Eles ja transformam historico real em slots, categorias, janelas e temas. Para V9B, vale reaproveitar a logica de agregacao, mas a fonte canonical do StudyContext server-side deve continuar sendo o historico real (`Metric`) mais snapshots agregados, nao apenas o payload de UI do planner.

Demografia e conta ja existem em `AccountInsight` e `AudienceDemographicSnapshot`. Esses dados sao agregados por conta, nao por post. Eles podem enriquecer contexto de marca/collab, mas nao devem ser usados para prometer performance de um formato especifico.

Comentarios textuais ainda sao lacuna. O banco guarda contagens de comentarios em `stats.comments`, `DailyMetricSnapshot.dailyComments`, `AccountInsight.comments` e `StoryMetric.replies`, mas nao foi encontrado um model dedicado com texto de comentarios, autor, timestamp e relacao com post. Portanto `comment_to_post` server-side ainda dependeria do input do usuario ou de uma futura fonte de comentarios.

Sinais comerciais existem em varios niveis: `Metric.isPubli`, `Metric.contentSignals`, `Metric.commercialMode`, `BrandNarrativeProfile`, `BrandNarrativeReport`, `BrandProposal`, `AdDeal`, `PubliCalculation` e `Campaign`. Nem todos sao igualmente confiaveis para StudyContext: `Metric` e reports/proposals ligados ao usuario sao mais confiaveis; seeds de marca e campanhas inbound sao contextuais e exigem normalizacao.

## Fontes atuais ja usadas pelo fluxo adaptativo

- `PostCreationFunnelBoardShell` monta `adaptiveStudyContext` no client com dados ja carregados no board, incluindo slots/recommendations, outcomeSignals, evidencePosts selecionados, sinais de marca e sinais de collab.
- `buildPostCreationAdaptiveStudyContext` aceita objetos defensivos (`plannerSlots`, `recommendations`, `outcomeSignals`, `evidencePosts`, `brandSignals`, `collabSignals`) e extrai sinais quantitativos e qualitativos sem depender de shape forte.
- `PostCreationDecisionEngine` usa `PlannerUISlot`, `PostCreationOutcomeSignal`, `PostCreationPreferenceSignals`, evidencePosts e expectedMetrics para montar decisoes, ideia candidata e evidencias de UI.
- `usePlannerData` recebe `/api/planner/batch` ou `/api/planner/public` e transforma slots em `PlannerUISlot`. Esse hook preserva muitos campos estrategicos, mas `evidencePosts` fica limitado a `id`, `title`, `coverUrl`, `postLink`, `totalInteractions`.

## Models encontrados

### `src/app/models/Metric.ts` - `Metric`

Fonte primaria para StudyContext server-side.

- Relacao: `user` referencia `User`; `instagramMediaId` identifica midia do Instagram.
- Texto: `description` guarda caption/legenda. Alguns endpoints tambem usam `text_content` como fallback em agregacoes antigas.
- Midia: `postLink`, `postDate`, `type`, `format`, `mediaUrl`, `thumbnailUrl`, `coverUrl`, `instagramMediaId`, `source`.
- Classificacao legada: `format`, `proposal`, `context`, `tone`, `references`.
- Classificacao V2/V2.5: `contentIntent`, `narrativeForm`, `contentSignals`, `stance`, `proofStyle`, `commercialMode`.
- Qualidade/classificacao: `classificationStatus`, `classificationError`, `classificationMeta`, `classificationQuarantine`, `rawData`.
- Comercial/collab: `isPubli`, `collab`, `collabCreator`.
- Metricas: `stats.views`, `reach`, `likes`, `comments`, `saved`, `shares`, `total_interactions`, `profile_visits`, `follows`, `impressions`, `video_views`, watch time, duration, taxas e ratios.
- Indices relevantes: `user + postDate`, `user + instagramMediaId` unique sparse, `stats.total_interactions`, campos de classificacao e `isPubli`.
- Confianca: alta para captions, classificacoes e metricas quando `source="api"` ou `classificationStatus="completed"`. `rawData` existe, mas seu shape nao deve ser assumido sem normalizacao.

### `src/app/models/DailyMetricSnapshot.ts` - `DailyMetricSnapshot`

Fonte de serie temporal por post.

- Relacao: `metric` referencia `Metric`.
- Metricas diarias/cumulativas: views, likes, comments, shares, saved, reach, impressions, follows, profile visits, total interactions, watch time.
- Indices: `metric + date` unico, `metric + date desc`, `metric + dayNumber`.
- Uso para StudyContext: medir tracao inicial, cauda longa e evolucao de performance por post. Nao substitui `Metric` para caption/classificacao.

### `src/app/models/DailyMetric.ts` - `DailyMetric`

Fonte historica por dia/post com campos normalizados em portugues.

- Relacao: `user`, `postId` ref `Metric`.
- Metricas: reproducoes, interacoes, curtidas, comentarios, compartilhamentos, salvamentos, reach, follower/non-follower breakdowns, ratios.
- Uso para StudyContext: possivel fallback ou historico legado. Para V9B, `DailyMetricSnapshot` e `Metric.stats` parecem mais diretos.

### `src/app/models/StoryMetric.ts` - `StoryMetric`

Fonte para stories.

- Relacao: `user`, `instagramAccountId`, `instagramMediaId`.
- Metricas: `views`, `reach`, `replies`, `shares`, `total_interactions`, `navigation`, `profile_activity`.
- Indices: `user + instagramMediaId` unique, `user + instagramAccountId + timestamp`.
- Uso para StudyContext: sinais especificos de stories e respostas (`replies`). Falta caption/classificacao narrativa equivalente a `Metric`.

### `src/app/models/AccountInsight.ts` - `AccountInsight`

Fonte agregada de conta.

- Relacao: `user`, `instagramAccountId`.
- Periodo: `recordedAt`, `accountInsightsPeriod.period`.
- Metricas de conta: views, reach, accounts_engaged, total_interactions, comments, likes, saved, shares, replies, profile_links_taps, follows_and_unfollows.
- Demografia embutida: `audienceDemographics.follower_demographics` e `engaged_audience_demographics` por city/country/age/gender.
- Perfil: `accountDetails.username`, name, biography, website, profile_picture_url, followers_count, follows_count, media_count.
- Indices: `user + recordedAt desc`, `instagramAccountId + recordedAt desc`.
- Uso para StudyContext: profileSummary, contexto de audiencia e sinais agregados. Nao e granular por post.

### `src/app/models/demographics/AudienceDemographicSnapshot.ts` - `AudienceDemographicSnapshot`

Fonte normalizada de demografia.

- Collection explicita: `audience_demographic_snapshots`.
- Relacao: `user`, `instagramAccountId`.
- Dados: follower/engaged audience por city, country, age, gender.
- Indices: `user + recordedAt desc`, `instagramAccountId`.
- Uso para StudyContext: enriquecer marca/collab e territorio de audiencia. Deve ser usado com linguagem cuidadosa por ser agregado.

### `src/app/models/PlannerPlan.ts` - `PlannerPlan`

Fonte de plano salvo.

- Collection explicita: `planner_plans`.
- Relacao: `userId`, `platform="instagram"`, `weekStart`.
- Slots: `dayOfWeek`, `blockStartHour`, `format`, `categories`, `contentIntent`, `narrativeForm`, `contentSignals`, `stance`, `proofStyle`, `commercialMode`, `expectedMetrics`, `title`, `scriptShort`, `notes`, `themeKeyword`, `status`, `isExperiment`.
- Indice unico: `userId + platform + weekStart`.
- Observacao: `PLANNER_PLAN_READ_PROJECTION` nao inclui `themes` nem `evidencePosts`; plano salvo e mais fino que recomendacoes frescas.

### `src/app/models/PlannerRecCache.ts` - `PlannerRecCache`

Snapshot de recomendacoes do planner.

- Relacao: `userId`, `platform`, `weekStart`.
- Dados: `recommendations` e `heatmap` como Mixed, `frozenAt`, `algoVersion`, `metricBase`.
- Indice unico: `userId + platform + weekStart`.
- Uso para StudyContext: cache de payload pronto. Bom para performance, mas precisa versionamento e cuidado porque o shape e livre.

### `src/app/models/BrandNarrativeProfile.ts` - `BrandNarrativeProfile`

Fonte de taxonomia/matching de marcas.

- Collection explicita: `brandnarrativeprofiles`.
- Dados: brandName, slug, category, subcategories, territories, contexts, narrativeForms, contentIntents, contentSignals, tones, proofStyles, commercialModes, products, campaignKeywords, avoidContexts, insertionIdeas, matchExamples, confidenceScore, usageStats.
- Uso para StudyContext: candidatos de brandSignals e guardrails de marca. Nao e historico do creator por si so.

### `src/app/models/BrandNarrativeReport.ts` - `BrandNarrativeReport`

Fonte de match comercial ja materializado para usuario/pauta.

- Collection explicita: `brandnarrativereports`.
- Relacao: `userId`.
- Dados: brand, creator, pauta, decisionSnapshot, match, evidencePosts, metricsSummary, reportContent.
- Evidence posts ricos: title, description, postLink, coverUrl, postDate, format, views, reach, likes, comments, shares, saved, totalInteractions.
- Uso para StudyContext: sinal comercial forte quando report existe. Pode alimentar brandSignals e referencePosts comerciais.

### `src/app/models/BrandProposal.ts`

Fonte de propostas inbound de marca.

- Relacao: `userId`, `mediaKitSlug`.
- Dados: brandName, campaignTitle, campaignDescription, deliverables, budget, status, referenceLinks, lastResponse, latestAnalysis, analysisHistory, UTM.
- Uso para StudyContext: historico comercial real do creator. Precisa normalizar status, recencia e confianca antes de influenciar gabarito.

### `src/app/models/AdDeal.ts`

Fonte de deals fechados.

- Relacao: `userId`; opcional `relatedPostId` ref `Metric`, `sourceCalculationId`.
- Dados: brandName, brandSegment, dealDate, campaign dates, deliverables, platform, compensation, notes, pricing link.
- Uso para StudyContext: sinal comercial real de historico de publis/deals. Bom para brand/collab/commercialMode, desde que filtrado por recencia e plataforma.

### `src/app/models/PubliCalculation.ts`

Fonte de calculos de precificacao.

- Relacao: `userId`.
- Dados: metrics reach/engagement/profileSegment, params de formato/entrega, quantities, rights/exclusivity, brandSize, contentModel, result, calibration, avgTicket, totalDeals.
- Uso para StudyContext: contexto comercial e formatos negociados. Nao e evidencia de performance editorial por si so.

### `src/app/models/Campaign.ts`

Fonte de campanhas inbound/publicas.

- Dados: brandName, budget, description, segments, referenceLinks, originCreatorHandle, originMediaKitSlug, source, status.
- Uso para StudyContext: demanda de mercado e origem de campanha. So deve influenciar creator especifico quando houver relacao clara por `originMediaKitSlug`/handle.

### `src/app/models/PostReview.ts`

Curadoria humana de post.

- Relacao: `postId` ref `Metric`.
- Dados: status `do`, `dont`, `almost`, note, reviewedBy.
- Uso para StudyContext: sinal editorial humano. Pode virar boost/degrade de referencePosts em V9B/V9C.

## Endpoints encontrados

### Planner

- `GET /api/planner/batch`: endpoint principal do board autenticado. Resolve target user, valida acesso, carrega `PlannerPlan`, `recommendWeeklySlots`, `getTimeBlockScores` e temas. Retorna plan, recommendations e heatmap. Ja usado por `usePlannerData`.
- `GET /api/planner/public`: endpoint publico por `userId`, retorna plano salvo ou recomendacoes/heatmap. Tem menos protecao de sessao, mas valida ObjectId e usa cache/freeze.
- `GET /api/planner/recommendations`: endpoint autenticado de recomendacoes/heatmap, usa `recommendWeeklySlots`, `getTimeBlockScores`, `getThemesForSlot` e `PlannerRecCache`.
- `POST /api/planner/plan`: salva slots em `PlannerPlan`, normaliza formato/categorias/classificacoes V2/V2.5, invalida cache e sincroniza scripts vinculados. Nao deve ser usado por V9B para montar StudyContext em tempo real, mas define shape confiavel de slot salvo.
- `POST /api/planner/pautas`: gera pautas com IA a partir de slot/categorias/tema e captions coletadas por `getBlockSampleCaptions`. E util para entender fontes, mas V9B nao deve depender dessa IA.
- `POST /api/planner/collab-creators`: usa rankings de creators, `Metric`, `User` e contexto/tema para sugerir collabs. Retorna avgInteractions, avgReach, avgShares, avgSaves, postCount, followers, matchType e scoreParts.

### Posts, media e metricas

- `GET /api/instagram/fetch-media`: busca midias recentes via Graph API, com caption, timestamp, permalink, media type, media URL, children e duracao. Retorna dados brutos; persistencia acontece em outra camada.
- `src/app/lib/instagram/db/metricActions.ts`: `saveMetricData` persiste midia/insights em `Metric`, agenda classificacao e cria `DailyMetricSnapshot`.
- `POST /api/metrics`: cria `Metric` via Document AI/manual, salva caption, stats e classificacoes iniciais; agenda worker de classificacao.
- `GET /api/v1/posts/[postId]/details`: retorna detalhes publicos de um `Metric`, removendo user/rawData/source/classification internals.
- `GET /api/admin/dashboard/posts` e `GET /api/agency/dashboard/posts`: listagem filtravel de posts via `findGlobalPostsByCriteria`, com filtros de classificacao legada e V2/V2.5, searchText e metricas.
- `GET /api/admin/dashboard/posts/[postId]/details` e agency equivalente: detalhes completos via `fetchPostDetails`, incluindo dailySnapshots.

### Insights e demografia

- `GET /api/demographics/[userId]`: retorna snapshot demografico mais recente de `AudienceDemographicSnapshot`.
- `GET /api/instagram/[userId]/demographics`: busca demografia no Instagram, grava `AudienceDemographicSnapshot` e cacheia via Redis.
- `GET /api/v1/platform/demographics` e `GET /api/admin/dashboard/demographics`: agregam demografia da plataforma, nao do creator especifico.
- `src/app/lib/instagram/api/fetchers.ts`: busca account insights, media insights e audience demographics da Graph API.

### Marca e comercial

- `POST /api/brand-narratives/match`: recebe decision/pauta/categories e calcula matches em `BrandNarrativeProfile`.
- `src/app/lib/brands/brandNarrativeMatcher.ts`: matching por pesos entre inputs narrativos e perfis de marca.
- `src/app/lib/brands/brandNarrativeReportBuilder.ts`: seleciona evidencePosts reais em `Metric`, gera summary e persiste `BrandNarrativeReport`.
- `GET/POST /api/brand-narratives/reports`: rotas de relatorio de marca ja usam `BrandNarrativeReport`.
- `src/app/api/proposals/*`: rotas de propostas de marca leem/escrevem `BrandProposal`.

### Collab/casting

- `POST /api/planner/collab-creators`: melhor fonte operacional para collab no contexto de uma pauta.
- `GET /api/landing/casting`: lista creators para casting usando `User`, `Metric` e `AccountInsight`; calcula totalInteractions, reach, formatos fortes, contexto de maior performance, seguidores e tags do perfil.

## Dados disponiveis por tipo

### Metricas de post

Disponiveis de forma confiavel em `Metric.stats` e em snapshots diarios. Campos principais: views, reach, likes, comments, saved, shares, total_interactions, profile_visits, follows, impressions, video views, watch time, video duration e ratios derivados. `Metric` tambem tem `postDate`, que permite janelas de horario/dia.

Para V9B, a query mais segura deve limitar por `user`, `postDate` e projetar apenas campos necessarios. Limite inicial sugerido: ultimos 90 a 180 dias, maximo 100-200 posts.

### Legendas/textos

Disponiveis em `Metric.description`; alguns pipelines tambem usam `text_content` como fallback legado. `getBlockSampleCaptions` ja busca descriptions por janela, categorias e performance. `PlannerPlan` guarda `title`, `scriptShort` e `notes`, mas esses sao plano/sugestao, nao necessariamente post publicado.

### Classificacoes narrativas

Disponiveis em `Metric`:

- Legado: `format`, `proposal`, `context`, `tone`, `references`.
- V2: `contentIntent`, `narrativeForm`, `contentSignals`.
- V2.5: `stance`, `proofStyle`, `commercialMode`.

As taxonomias estao em `classification.ts`, `classificationV2.ts` e `classificationV2_5.ts`. A persistencia vem do worker `api/worker/classify-content` e da criacao manual/document_ai em `/api/metrics`.

### Comentarios e respostas da audiencia

Disponivel apenas como contagem:

- `Metric.stats.comments`
- `DailyMetricSnapshot.dailyComments` e `cumulativeComments`
- `AccountInsight.accountInsightsPeriod.comments`
- `StoryMetric.stats.replies`

Nao foi encontrado model de texto de comentarios com autor, timestamp e relacao com post. Isso e lacuna para `comment_to_post` baseado em comentarios reais.

### Demografia

Disponivel por conta:

- `AccountInsight.audienceDemographics`
- `AudienceDemographicSnapshot.demographics`
- Breakdowns por age, gender, country, city para follower e engaged audience.

Nao ha demografia por post. Para V9B, usar como contexto de marca/collab e nao como explicacao causal de performance.

### Sinais comerciais

Disponiveis em camadas:

- `Metric.isPubli`, `Metric.contentSignals`, `Metric.commercialMode`, `Metric.proposal` com publi/divulgacao.
- `BrandNarrativeProfile` com territorios, produtos, keywords e modos comerciais de marcas.
- `BrandNarrativeReport` com matches e posts de evidencia ricos.
- `BrandProposal`, `AdDeal`, `PubliCalculation`, `Campaign` para historico comercial e demanda.

Confianca varia por fonte. Deals e reports ligados ao usuario sao mais fortes; taxonomia de marca e campanhas publicas precisam de relacao explicita.

### Collabs/casting

Disponiveis em:

- `Metric.collab`, `Metric.collabCreator`, `contentSignals.collab`.
- `/api/planner/collab-creators` e `collabCreatorScoring`, que agregam performance de outros creators por contexto/tema.
- `landing/castingService`, que agrega creators ativos, seguidores, formatos fortes e top context.

Para StudyContext do proprio creator, collab deve ser sinal de oportunidade e nao uma afirmacao de relacao existente, salvo quando `Metric.collab`/`collabCreator` ou deals/propostas confirmarem.

### Planner/evidence posts

`recommendWeeklySlots` usa `Metric` para calcular:

- formato por bloco;
- combinacoes de contexto/proposta/formato;
- janelas de postagem;
- expectedMetrics com viewsP50/viewsP90;
- evidencePosts vencedores por formato/proposta/contexto.

Porem `PlannerEvidencePost` no tipo compartilhado e fino: `id`, `title`, `coverUrl`, `postLink`, `totalInteractions`. Para V9B, se o builder server-side for consultar `Metric` diretamente, pode montar referencePosts mais ricos com caption, format, context, proposal, tone, reach, saves, shares e comments.

## Campos confiaveis para V9B

Mais confiaveis:

- `Metric.user`, `postDate`, `description`, `postLink`, `instagramMediaId`, `type`, `format`, `stats.views`, `stats.reach`, `stats.comments`, `stats.saved`, `stats.shares`, `stats.total_interactions`.
- Classificacoes em `Metric` quando `classificationStatus="completed"` ou quando campos existem e passam pela canonicalizacao atual.
- `DailyMetricSnapshot` para evolucao temporal de posts recentes.
- `AccountInsight.accountDetails` e `AccountInsight.accountInsightsPeriod` mais recente.
- `AudienceDemographicSnapshot` mais recente.
- `PlannerPlan.slots` quando o objetivo e considerar escolhas salvas do usuario.
- `BrandNarrativeReport.evidencePosts` e `metricsSummary` quando o relatorio existe para o usuario.
- `AdDeal` e `BrandProposal` para historico comercial real.

Usar com cautela:

- `PlannerRecCache.recommendations` por ser Mixed e versionado por algoritmo.
- `PlannerUISlot.themes` no client, porque plano salvo nao projeta `themes`; recomendacoes frescas podem trazer temas, mas o campo nao e garantido.
- `expectedMetrics.savesP50` e `expectedMetrics.commentsP50`: o builder client ja tenta ler esses caminhos, mas o tipo atual do planner exposto so garante `viewsP50`, `viewsP90` e `sharesP50`.
- `rawData` em `Metric`: existe, mas nao tem contrato publico para o StudyContext.
- `classificationMeta`: potencialmente util para confidence/evidence, mas precisa auditoria de preenchimento real por versao.

## Lacunas encontradas

- Nao ha model de comentarios textuais reais. So ha contagem de comentarios/respostas.
- `PlannerEvidencePost` nao carrega caption/classificacao/metrica rica para o client.
- `PlannerPlan` salva/projeta `themeKeyword`, mas nao `themes` nem `evidencePosts`.
- `PlannerRecCache` guarda payload Mixed; precisa versionamento defensivo se for usado diretamente.
- Nem todo post tera classificacao V2/V2.5, principalmente historico antigo, classificacao pendente ou falha.
- Demografia e agregada por conta, nao por post ou audiencia do post.
- Story data existe em `StoryMetric`, mas nao tem a mesma camada narrativa/caption/classificacao de `Metric`.
- Sinais comerciais estao espalhados em varias fontes e precisam de ranking de confianca.
- Dados de collab/casting misturam o proprio creator, outros creators e contexto de marketplace; V9B precisa separar `selfStudyContext` de `marketplaceOpportunityContext`.

## Dados que precisam de normalizacao

- Formatos: `reel`, `photo`, `carousel`, `story`, `long_video`, `VIDEO`, `REEL`, `CAROUSEL_ALBUM`, labels em portugues.
- Categorias legadas e V2/V2.5: usar canonicalizacao existente (`classification`, `classificationV2`, `classificationV2_5`).
- Metricas de salvamento: `saved` vs `saves`.
- Interacoes: `total_interactions`, `engagement`, soma likes/comments/shares/saved quando ausente.
- Caption/texto: `description` vs `text_content`.
- Data/horario: sempre calcular janelas no fuso do planner (`PLANNER_TIMEZONE`).
- Evidence posts: deduplicar por `_id`/`instagramMediaId`/`postLink` e limitar volume.
- Comercial: distinguir `publi detectada no post`, `deal fechado`, `proposta inbound`, `match narrativo` e `taxonomia de marca`.

## Proposta de arquitetura para V9B, sem implementar

Criar um builder server-side puro na camada de dominio, por exemplo:

```ts
buildPostCreationAdaptiveStudyContextServerSide(userId, options)
```

Fluxo sugerido:

1. Validar permissao: dono, admin/dev target ou regras equivalentes ao planner.
2. Resolver `periodDays` com default 90 e maximo defensivo, por exemplo 180 ou 365.
3. Consultar `Metric` por `user` e `postDate`, com projection explicita:
   - texto, data, link, midia;
   - classificacoes legadas/V2/V2.5;
   - stats principais;
   - publi/collab;
   - classificationStatus/meta se necessario.
4. Consultar `DailyMetricSnapshot` apenas para os top posts ou posts recentes que precisarem de curva temporal.
5. Consultar `AccountInsight` e `AudienceDemographicSnapshot` mais recentes.
6. Consultar `PlannerPlan` da semana atual/ultimas semanas se for necessario considerar plano salvo.
7. Consultar `BrandNarrativeReport`, `BrandProposal` e `AdDeal` com limites por recencia.
8. Opcionalmente consultar `StoryMetric` para sinais de stories.
9. Normalizar tudo para um input interno, sem expor modelos Mongoose ao AnswerKey.
10. Reutilizar o builder client atual onde fizer sentido, ou criar uma versao server que produza o mesmo contrato com `source: "planner_server"` em fase futura.
11. Cachear por userId + periodDays + data de ultima atualizacao relevante. TTL inicial sugerido: 5 a 15 minutos.
12. Registrar metadados de confianca e coverage: posts analisados, posts classificados, posts com caption, posts com metricas, demographics disponivel, commercial data disponivel.

Limites de volume sugeridos:

- `Metric`: 100-200 posts recentes ou top por interacoes no periodo.
- `DailyMetricSnapshot`: somente top 20-40 posts.
- `BrandNarrativeReport`: ultimos 5-10.
- `BrandProposal`/`AdDeal`: ultimos 20-50.
- `StoryMetric`: ultimos 100 ou ultimos 90 dias.

## Riscos tecnicos

- Performance: consultar muitos posts, snapshots e reports em uma rota interativa pode degradar o board. Precisa projection, limites e cache.
- Fonte duplicada: planner/recommendations e StudyContext podem recalcular sinais parecidos com algoritmos diferentes. V9B deve deixar claro qual fonte vence.
- Dados incompletos: posts antigos podem nao ter V2/V2.5 ou captions limpas.
- Promessa de dado inexistente: feedback nao deve mencionar comentario textual, demografia por post ou causalidade se so houver contagem/agregado.
- Privacidade/permissao: StudyContext server-side precisa respeitar owner/admin/dev/agency e nao vazar dados de outros creators usados em casting.
- Mixed/cache: `PlannerRecCache` e `rawData` podem mudar de shape.
- IA indireta: planner/pautas/themes usam IA em alguns caminhos; V9B deve separar sinais deterministicos de dados gerados por IA.
- Comercial: brand matches podem ser sugestoes, nao relacoes comerciais reais. Texto deve preservar disclaimer.

## Recomendacao de sequencia

V9B:

- Criar `PostCreationAdaptiveStudyContextServerInput` e normalizador server-side sem endpoint publico novo.
- Implementar queries bounded em `Metric`, `AccountInsight`, `AudienceDemographicSnapshot`, `PlannerPlan`, `BrandNarrativeReport`, `BrandProposal`, `AdDeal`.
- Produzir contexto deterministico e testavel, ainda sem conectar ao board.

V9C:

- Conectar builder server-side a um endpoint existente ou novo com guard forte, se o produto decidir.
- Definir cache e invalidacao por userId/periodDays.
- Testar permissao, performance e fallback client-side.

V9D:

- Usar o contexto server-side no AnswerKey/NativeFlow quando disponivel.
- Manter fallback para StudyContext client-side.

V9E:

- Resolver lacuna de comentarios reais se `comment_to_post` precisar estudar comentarios da audiencia, com model/endpoint proprio e politicas de privacidade.

