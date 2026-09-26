# Campos que ocupam espaço sem servir ao produto — 26/09/2026

Leitura somente de consulta no banco `data2content` (driver nativo, sem alterar documentos nem índices), cruzada com o código de desktop, celular e MCP. Continuação da [avaliação de 07/09](auditoria-mongodb-armazenamento-2026-09-07.md), que já limpou histórico antigo e PDFs vencidos. **Nada foi apagado nesta análise.**

MB = 1.000.000 bytes. Tamanhos de campo são BSON lógico (`$bsonSize`), a mesma base que a cota Free/Flex usa; não é promessa de igual queda no disco físico.

## Execução em 26/09/2026

Arthur aprovou as correções. Aplicado com `npm run maintenance:mongo-fields` ([script](../scripts/trimUnusedMongoFields.mjs), testes em `npm run test:mongo-fields`), que simula por padrão e exige `--apply --expected-db=data2content`:

| Item | Feito | Efeito |
| --- | --- | --- |
| A1 | 33.743 registros de `accountinsights` sem foto/bio/site antigos; 278 usuários continuam com foto no registro que as telas consultam | −21,4 MB |
| A2 | Removidos `metric_1` e `dayNumber_1`; `idx_metric_history` saiu do modelo | −11,5 MB agora |
| A3 | 190.265 snapshots sem `dailyImpressions`, `cumulativeImpressions`, `__v` | ≈ −11 MB (incluindo nomes de campo) |
| A4 | Removidos os três índices de `fetchDate` | −1 MB |
| C3 | TTL real de 30 dias em `plannerreccaches.frozenAt` (índice `frozenAt_ttl`); 400 de 406 expiraram | −4 MB |

Total medido: **442,56 → 393,80 MB** (dados + índices dos dois bancos). Cópias recuperáveis em `output/mongodb-maintenance/campos-2026-09-26T03-48-02-950Z/` (perfil) e `campos-2026-09-26T03-57-40-817Z/` (cache do planejamento), com SHA-256 em `resultado.json`. Os zeros não têm cópia: o filtro só retirou valores 0/vazios. As consultas de último snapshot, histórico do post, dia do post e avatar foram conferidas com `explain` depois da remoção: todas usam índice, 1 chave examinada nas buscas pontuais.

Código alterado junto (ainda não publicado):

- `accountInsightActions.ts`: ao gravar registro com foto, retira foto/bio/site dos anteriores do mesmo usuário e conta.
- `metricActions.ts` e `DailyMetricSnapshot.ts`: param de gravar impressions e `__v`; `idx_metric_history` sai do modelo. Top movers do admin perdeu a opção "Impressões" (sempre zero).
- `geminiGovernance.ts`: recibo compactado nunca vira nova cobrança (teste incluído).
- `PlannerRecCache.ts`: TTL de 30 dias fixo, sem depender de `PLANNER_FREEZE_TTL_DAYS` (nunca definida).

**Pendente depois da publicação:**

1. `npm run maintenance:mongo-fields -- --apply --expected-db=data2content --drop-after-deploy` (≈ −18 MB): `idx_metric_history` e `idx_metric_dayNumber` dos snapshots (este só servia a `calculateCumulativeEngagementPercentage`, sem chamadores) e 10 índices de `metrics` com zero uso em 18 dias no primário (`tone`, `references`, `narrativeForm`, `contentSignals`, `stance`, `proofStyle`, `commercialMode`, `source`, `classificationLastQueuedAt`, `isPubli`). `stats.total_interactions_-1` fica: a Descobrir ordena por ele e, sem índice, a ordenação pode estourar a memória do plano gratuito. Antes da publicação o Mongoose da produção recriaria esses índices.
2. A partir de 14/10, compactar recibos do Gemini de leituras concluídas há 30 dias com `--compact-gemini-receipts` (~0,8 MB/dia de crescimento contido). Idealmente entra na rotina diária de retenção.
3. B1 e B2 esperam o trabalho da camada de leitura de capa/miniatura que está sem commit no repositório (mesmos arquivos: `postsService.ts`, `postReviewsService.ts`).

**Decidido não mexer:** C2. O sino do chat ainda migra `users.alertHistory` para `alerts` na primeira abertura; apagar mudaria o que esses usuários veem. A consolidação resultado × evidência de C1 também fica de fora: os dois são lidos por MCP, relatório semanal e roteiros.

**Achado lateral:** o cache do planejamento nunca é lido. `algoVersion` é `String` no schema e as rotas comparam com número (`=== 3`), então a verificação sempre falha e a recomendação é recalculada a cada pedido. Corrigir muda o comportamento (passa a servir recomendação congelada), por isso não foi corrigido aqui. Ver `brain/30 Armadilhas/Cache do planejamento nunca acerta.md`.

## Capacidade no plano gratuito (medido em 26/09/2026)

O cluster é M0 (gratuito): cota de 512 MiB = 536,9 MB de dados lógicos + índices. Após a execução: 393,8 MB. Entrada bruta nos últimos 14 dias: **~4 MB/dia**:

| Coleção | MB/dia | Observação |
| --- | ---: | --- |
| `daily_metric_snapshots` | 0,87 | Retenção de 8 meses; ainda não chegou ao equilíbrio (~+65 MB até lá) |
| `gemini_operations` + `published_content_evidence` + `content_reading_states` | 2,03 | Leitura publicada; sem retenção nenhuma |
| `metrics` | 0,53 | Posts; cresce com criadores conectados |
| `creatorweeklyreports` | 0,17 | Payload completo por semana, sem retenção |
| Demais | ~0,4 | |

Com a publicação e as limpezas pendentes, a folga é de aproximadamente dois a três meses. Ficar no gratuito depende de políticas de retenção para as coleções que crescem sem teto e de tirar textos grandes do MongoDB.

## Situação (antes da execução)

| Medida | 08/09 (após limpeza) | 26/09 |
| --- | ---: | ---: |
| Dados + índices, bancos `data2content` + `test` | 392,35 MB | **442,56 MB** |

Cresceu cerca de **50 MB em 18 dias (~2,7 MB/dia)**. Se a cota for 512 MiB (537 MB, não confirmado no painel do Atlas), sobram ~94 MB, ou cerca de cinco semanas nesse ritmo. Boa parte do crescimento vem da leitura publicada em lote, iniciada em 14/09 (`gemini_operations`, `content_reading_states`, `published_content_evidence`). A retenção diária de snapshots continua funcionando.

## Oportunidades

### Grupo A — nenhum recurso lê; retirar não muda o que o usuário vê

| # | O quê | Ganho |
| --- | --- | ---: |
| A1 | `accountinsights.accountDetails`: foto de perfil, bio e site copiados em **cada um dos 34.024 registros** de 278 usuários | ~21 MB |
| A2 | Índices redundantes em `daily_metric_snapshots` | ~20 MB |
| A3 | Campos sempre zero ou vazios em `daily_metric_snapshots` (`dailyImpressions`, `cumulativeImpressions`, `__v`) | ~6,8 MB |
| A4 | Índices de `accountinsights` sobre `fetchDate`, campo que não existe em nenhum registro | ~1 MB |

**A1.** Todas as leituras de `accountDetails.profile_picture_url` (mídia kit público e próprio, avatar, OG image, avatar do Collabs, revista, relatório) fazem `findOne(... $exists ...).sort({ recordedAt: -1 })`: usam só o registro **mais recente** com foto. `aiFunctions.ts` também só lê o último. Os outros 33.746 registros carregam cópias que ninguém consulta: 15,4 MB de URLs de foto, **97,7% já vencidas** no CDN do Instagram, e bio com apenas 931 valores distintos em 34 mil cópias (5,1 MB). Proposta: manter foto, bio, site, nome e usuário só no registro mais recente de cada usuário/conta; preservar `followers_count` (é reserva de `followersCount` em `followerGrowthStagnationRule`, `communityStatsService` e `adminCreatorSurveyService`). Para não voltar a crescer, a gravação em `accountInsightActions.ts` deve retirar esses campos do registro anterior (ou a rotina diária de retenção passa a fazer isso).

**A2.** `metric_1` (5,8 MB) e `dayNumber_1` (6,2 MB) existem no banco mas não estão declarados no modelo; `metric_1` é prefixo do índice único `{metric, date}` e nenhuma consulta filtra só por `dayNumber`. `idx_metric_history` `{metric:1, date:-1}` (8,3 MB) repete o único percorrido ao contrário, o que a auditoria de 07/09 já verificou com `explain`; está declarado em `DailyMetricSnapshot.ts:85`, então sai do modelo junto. Manter `idx_metric_date_unique`, `idx_metric_dayNumber` (usado em `calculateCumulativeEngagementPercentage`) e `date_1` (usado nas agregações por período da plataforma). Os contadores de uso (`$indexStats`) são de um só nó e desde 08/09; servem de apoio, não de prova.

**A3.** A Meta aposentou "impressions": 100% dos 190 mil snapshots guardam zero. A única tela que lê (`publis/[id]`) usa como último recurso depois de views e reach. `__v` é 0 em todos. Parar de gravar e retirar dos registros existentes.

### Grupo B — dado vencido que a tela já não consegue usar

| # | O quê | Ganho |
| --- | --- | ---: |
| B1 | `metrics.mediaUrl` (link do vídeo no CDN do Instagram) | até ~20 MB |
| B2 | Capa e miniatura idênticas em `metrics` | ~14,75 MB |

**B1.** 82% dos 22.910 links de vídeo guardados já venceram (19,9 MB). A leitura de cena **não usa** o link guardado: `freshPublishedMedia` busca um link novo na Graph API na hora. O MCP exclui `mediaUrl` do contrato. Quem ainda lê o campo são os players do planejamento, do Discover e do post-analysis, que com link vencido já não tocam. Proposta: buscar o link na hora de tocar (como a leitura faz) e deixar de guardar; exige conferir esses players em tela antes de limpar.

**B2.** Já planejado em [plano-deduplicacao-capas-metricas-2026-09-25.md](plano-deduplicacao-capas-metricas-2026-09-25.md). A capa (`coverUrl`) deve continuar: 84% está vencida, mas `/api/media/cover/[id]` usa a presença dela e renova pela Graph quando falha.

### Grupo C — duplicações e sobras; exigem decisão ou pequena refatoração

| # | O quê | Ganho |
| --- | --- | ---: |
| C1 | A mesma leitura de vídeo guardada em até três formas | 9–18 MB, e desacelera o crescimento |
| C2 | Sistema de alertas antigo (`users.alertHistory` + `alerts`) | ~3,6 MB |
| C3 | `plannerreccaches` congelados desde 2025 | ~3 MB |

**C1.** Para cada vídeo lido: a resposta bruta do Gemini em `gemini_operations.response` (9,4 MB), o resultado interpretado em `content_reading_states.result` (8,7 MB) e a evidência em `published_content_evidence` (14,3 MB). Em 397 de 400 amostras a transcrição aparece nas duas últimas. A resposta bruta serve para não pagar duas vezes numa nova tentativa; depois de a leitura concluir, pode expirar (por exemplo, 30 dias). Consolidar resultado e evidência é refatoração de `creatorWeeklyReport`, `mapaSeed` e MCP, não limpeza. `gemini_operations` não tem TTL.

**C2.** Todos os 1.817 itens de `alertHistory` são de 06/2025 a 19/12/2025; nada novo desde então. `ChatPanel` ainda chama `useAlerts`. Confirmar se o painel de alertas aparece para alguém antes de arquivar.

**C3.** Já apontado em 07/09; o TTL é opcional e não existe no banco.

### O que já se cuida sozinho ou não vale mexer

- `geminishadowcomparisons` (3,3 MB) e `geminiusagelogs` têm TTL real de 60/90 dias no banco; a comparação parou em 14/09 e esvazia sozinha até novembro.
- Os nomes longos de campos dos snapshots custam boa parte de cada registro, mas renomear mexe em dezenas de leitores. Não recomendado.
- `dailyProfileVisits`, `dailyFollows` e acumulados são quase sempre zero (a Meta não entrega para Reels), mas vários geradores de insight os leem sem `?? 0` garantido. Não mexer sem teste.
- Os 20 índices de `metrics` sobre dimensões de classificação (~7 MB) têm uso baixo no nó observado, mas servem a filtros do Discover e do painel. Validar consulta por consulta antes.
- Banco `test` (1,5 MB): a auditoria anterior já alertou que scripts podem cair nele sem fixar o nome do banco.

## Soma

| Grupo | Ganho estimado | Risco para o produto |
| --- | ---: | --- |
| A | ~49 MB | Nenhum recurso lê |
| B | ~35 MB | Baixo; exige conferir players e seguir o plano da capa |
| C | ~15–25 MB | Exige decisão ou refatoração |
| **Total** | **~100–110 MB (~23–25%)** | |

Os ganhos não são exatamente aditivos (índices crescem durante exclusões; ver a nota de 07/09). Remover índice libera espaço na hora; `$unset` reduz o tamanho lógico, e o Atlas pode levar um tempo para refletir.

## Ordem sugerida

1. A2 + A4 (índices): menor esforço, efeito imediato e reversível (dá para recriar).
2. A1 + A3: script em `scripts/` com `--dry-run` por padrão, cópia recuperável antes, lotes, como em `maintainMongoStorage.mjs`; mais a mudança no gravador para não voltar.
3. B2 (plano já pronto) e B1 (depois de conferir os players).
4. C1: TTL na resposta bruta concluída; consolidação só se valer a refatoração.
5. Confirmar a cota real do cluster no painel do Atlas.
