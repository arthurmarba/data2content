---
tipo: domínio
---

# Instagram e métricas — de onde vêm os números

## Onde mora

| Peça | Caminho |
| --- | --- |
| Integração | `src/app/lib/instagram/` (`api/`, `sync/`, `webhooks/`, `db/`) |
| Reconexão | `reconnectFlow.ts`, `reconnectErrors.ts`, `reconnectConfig.ts` |
| Permissões pedidas | `oauthPermissions.ts` |
| Atualização pela fila | `/api/worker/refresh-instagram-user` |
| Atualização no relógio | `/api/cron/refresh-instagram-data` |
| Início da vinculação | `/api/auth/iniciar-vinculacao-fb` |
| Modelos | `Metric`, `DailyMetric`, `DailyMetricSnapshot`, `StoryMetric`, `AccountInsight` |

## O que é frágil aqui

**A demografia da audiência.** A Meta entrega esse dado de forma instável — às vezes vem incompleto, às vezes não vem. Qualquer card que dependa dela precisa de um estado de "ainda não dá pra dizer" que não pareça um erro. Ver [[Card de audiência trava]].

**O token expira.** Existe um fluxo inteiro de reconexão porque a autorização do criador cai sozinha com o tempo. Uma conta "sem dados" quase sempre é uma conta desconectada.

## Ferramentas

Retenção aprovada em 07/09/2026: `daily_metric_snapshots` conserva oito meses e
uma referência anterior por post; `metrics` e conteúdo do criador são preservados.
`npm run maintenance:mongo-storage` simula a limpeza. Procedimento e aplicação:
[[Histórico diário conserva oito meses e uma referência]].

### Ocupação medida em 25/09/2026 — hipóteses, sem limpeza adicional

- Nos 189.750 `daily_metric_snapshots`, campos numéricos com valor zero ocupam
  **44,21 MB** dos 119,00 MB de documentos. O schema atribui zero por padrão;
  omitir zeros exige que todas as leituras (inclusive `.lean()` e agregações) tratem
  campo ausente como zero. Há **35.461 snapshots intermediários sem mudança**
  (22,24 MB), mas esse ganho se sobrepõe ao dos campos zerados e retirar dias
  exige reconstruir lacunas nos gráficos e guardar a última checagem separadamente.
- Em `metrics`, `thumbnailUrl` é igual a `coverUrl` nos **23.641** registros que
  têm miniatura: duplicação exata de **14,75 MB**. As três URLs de mídia ocupam
  61,04 MB. Os parâmetros `oe` indicam prazo passado em aproximadamente
  **49,47 MB** dessas URLs; uma amostra HTTP confirmou 403 em link antigo e 200
  em link recente. Não apagar URLs sem revisar todas as telas e ter busca de URL
  atualizada ou mídia própria fora do MongoDB.
- `accountinsights` grava a cada sincronização. Conservar só a última medição por
  conta/dia economizaria **15,95 MB** hoje; conservar a primeira e a última,
  **8,08 MB**. Só **0,39 MB** são repetições exatas dos valores principais no
  mesmo dia; consolidar o restante perde variação intradiária. Algumas leituras
  usam primeiro/último ponto de um período; rever esses cálculos antes de consolidar.
- Três índices de snapshots (`metric_1`, `dayNumber_1`,
  `idx_metric_dayNumber`) somam **20,67 MB** e tiveram zero leituras no nó
  observado desde 08/09. O índice único composto já serve buscas por `metric`;
  nenhum filtro por `dayNumber` foi encontrado no código vivo. `$indexStats`
  não prova desuso em todos os nós ou rotas raras: validar consultas e `explain`
  antes de remover índices. Manter `idx_metric_history` até adaptar a ordenação
  da rotina de retenção.

**Revisão de segurança em 25/09/2026:** esses volumes são oportunidades brutas,
não economia segura para aplicar diretamente. A API de snapshots diários devolve
documentos `.lean()` sem preencher campos ausentes: omitir zeros pode mudar o
contrato de resposta. Remover dias sem variação pode alterar gráficos e regras que
buscam especificamente o 2º ou 3º dia do post; a pesquisa pelo MCP calcula a
aceleração usando também a quantidade de dias observados. Consolidar
`AccountInsight` dentro do dia muda a primeira leitura de uma janela e a contagem
de medições, mesmo preservando seu fechamento. Remover `thumbnailUrl` exige
normalizar as leituras para `coverUrl`, inclusive na agregação de avaliações e no
mídia kit. Não apagar URLs antigas sem alternativa testada para contas desconectadas.
Nenhuma dessas mudanças foi aplicada como parte desta avaliação.

```bash
npm run refresh:metrics:user      # atualiza um criador específico
npm run backfill:demographics     # preenche demografia histórica
npm run test:demographics         # confere o que a Meta devolve hoje
npm run ensure-indexes            # garante os índices do banco
```

## Ligações

[[Classificação de conteúdo]] · [[Seu Mapa]] · [[Filas e rotinas]]


## Revisão da pesquisa externa — setembro de 2026

`/creator-research` oferece consulta por @ a contas autenticadas e a mesma pesquisa
Business Discovery do MCP. O consentimento adicional `pages_read_engagement` é
opcional e iniciado nessa tela por `startInstagramReconnect({publicResearch:true})`.
O login comum não muda. O retorno OAuth usa `next=creator-research`.

Marketplace nessa tela continua restrito ao administrador autorizado ou a uma
concessão vigente em `CreatorResearchReviewGrant`, vinculada ao próprio usuário.
A concessão não altera `role` nem autoriza o MCP admin ou outras telas admin.
A consulta de autorização exige usuário existente e verifica expiração na leitura,
além do TTL de limpeza. Nunca compartilhar token da marca Arthur com o avaliador.
O callback Marketplace já cadastrado na Meta é preservado, mas retorna à nova tela.
