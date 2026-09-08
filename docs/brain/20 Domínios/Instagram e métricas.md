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

```bash
npm run refresh:metrics:user      # atualiza um criador específico
npm run backfill:demographics     # preenche demografia histórica
npm run test:demographics         # confere o que a Meta devolve hoje
npm run ensure-indexes            # garante os índices do banco
```

## Ligações

[[Classificação de conteúdo]] · [[Seu Mapa]] · [[Filas e rotinas]]
