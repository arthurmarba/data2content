---
gerado: automaticamente
atualizado: 2026-09-07
---

> [!warning] Nota gerada por script — não edite à mão.
> Rode `npm run brain` para atualizar. Fonte: `scripts/brain/gerar-inventario.mjs`.

# Trabalhos em fundo

Duas famílias: **cron** (roda sozinho, no relógio) e **worker** (roda quando alguém enfileira um trabalho, via QStash).

Os dois grupos são protegidos: cron por `CRON_SECRET`, worker pela assinatura do QStash.

## Cron — 17 tarefas no relógio

| Tarefa | Arquivo |
| --- | --- |
| `backfill-post-covers` | `src/app/api/cron/backfill-post-covers/route.ts` |
| `creator-weekly-reports` | `src/app/api/cron/creator-weekly-reports/route.ts` |
| `expire-trials` | `src/app/api/cron/expire-trials/route.ts` |
| `mature-affiliate-commissions` | `src/app/api/cron/mature-affiliate-commissions/route.ts` |
| `notify-free-month-ending` | `src/app/api/cron/notify-free-month-ending/route.ts` |
| `persist-usage-counters` | `src/app/api/cron/persist-usage-counters/route.ts` |
| `populate-community-inspirations` | `src/app/api/cron/populate-community-inspirations/route.ts` |
| `recover-content-intelligence` | `src/app/api/cron/recover-content-intelligence/route.ts` |
| `refresh-instagram-data` | `src/app/api/cron/refresh-instagram-data/route.ts` |
| `regenerate-content-ideas` | `src/app/api/cron/regenerate-content-ideas/route.ts` |
| `send-daily-tips` | `src/app/api/cron/send-daily-tips/route.ts` |
| `weekly-map-summary` | `src/app/api/cron/weekly-map-summary/route.ts` |
| `weekly-mapa-whatsapp` | `src/app/api/cron/weekly-mapa-whatsapp/route.ts` |
| `weekly-report-close` | `src/app/api/cron/weekly-report-close/route.ts` |
| `weekly-scene-evaluation` | `src/app/api/cron/weekly-scene-evaluation/route.ts` |
| `weekly-whatsapp-message` | `src/app/api/cron/weekly-whatsapp-message/route.ts` |
| `whatsapp-trial` | `src/app/api/cron/whatsapp-trial/route.ts` |

## Worker — 7 trabalhos enfileirados

| Trabalho | Arquivo |
| --- | --- |
| `backfill-post-cover` | `src/app/api/worker/backfill-post-cover/route.ts` |
| `classify-content` | `src/app/api/worker/classify-content/route.ts` |
| `classify-published-scene` | `src/app/api/worker/classify-published-scene/route.ts` |
| `enrich-mapa-video` | `src/app/api/worker/enrich-mapa-video/route.ts` |
| `generate-creator-weekly-report` | `src/app/api/worker/generate-creator-weekly-report/route.ts` |
| `process-story-webhook` | `src/app/api/worker/process-story-webhook/route.ts` |
| `refresh-instagram-user` | `src/app/api/worker/refresh-instagram-user/route.ts` |

## Agendamento

O cadastro dos horários vive em `src/scripts/scheduleCrons.ts` (`npm run schedule:crons`) e no `vercel.json`, quando houver.
