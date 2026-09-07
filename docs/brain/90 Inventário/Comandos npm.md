---
gerado: automaticamente
atualizado: 2026-09-07
---

> [!warning] Nota gerada por script — não edite à mão.
> Rode `npm run brain` para atualizar. Fonte: `scripts/brain/gerar-inventario.mjs`.

# Comandos npm

**89 comandos.** Os que carregam `--env-file=.env.local` mexem no banco de verdade — leia antes de rodar.

## básicos

| Comando | O que roda |
| --- | --- |
| `npm run brain` | `node scripts/brain/gerar-inventario.mjs` |
| `npm run build` | `sh -c 'export NODE_OPTIONS="--max-old-space-size=4096 ${NODE_OPTIONS:-}"; npm run playwright:install-chromium && ./scripts/with-preferred-node.sh next build && node scripts/include-video-analysis-ffmpeg-trace.mjs'` |
| `npm run dev` | `sh -c 'NODE_OPTIONS="--dns-result-order=ipv4first --max-old-space-size=4096 ${NODE_OPTIONS:-}" NEXT_DISABLE_SERVER_IPC=1 NEXTAUTH_URL="${NEXTAUTH_URL:-http://localhost:${PORT:-3000}}" ./scripts/with-preferred-node.sh next dev -H 127.0.0.1 -p ${PORT:-3000}'` |
| `npm run ensure-indexes` | `tsx --env-file=.env.local ./scripts/ensureIndexes.ts` |
| `npm run fix-formats` | `tsx --env-file=.env.local ./scripts/fixFormatLabels.ts` |
| `npm run force-clean-indexes` | `tsx --env-file=.env.local ./scripts/forceCleanIndexes.ts` |
| `npm run lint` | `eslint src --quiet` |
| `npm run migrate-affiliates` | `tsx --env-file=.env.local ./scripts/migrate-affiliates.ts` |
| `npm run normalize-format` | `tsx --env-file=.env.local ./scripts/normalizeFormatFromMetricType.ts` |
| `npm run reclassify` | `tsx --env-file=.env.local ./scripts/reclassifyAll.ts` |
| `npm run reset-classification` | `tsx --env-file=.env.local ./scripts/resetClassificationStatus.ts` |
| `npm run reset-classification-failed` | `tsx --env-file=.env.local ./scripts/resetFailedClassificationStatus.ts` |
| `npm run start` | `sh -c 'NODE_OPTIONS="--dns-result-order=ipv4first ${NODE_OPTIONS:-}" NEXTAUTH_URL="${NEXTAUTH_URL:-http://localhost:${PORT:-3000}}" ./scripts/with-preferred-node.sh next start -H 127.0.0.1 -p ${PORT:-3000}'` |
| `npm run test` | `jest --watchAll=false` |
| `npm run typecheck` | `npm run smoke:types` |

## apply

| Comando | O que roda |
| --- | --- |
| `npm run apply:classification-quarantine-reviewed` | `tsx --env-file=.env.local ./scripts/applyReviewedClassificationQuarantineResolutions.ts` |

## audit

| Comando | O que roda |
| --- | --- |
| `npm run audit:affiliate-financial-integrity` | `tsx --env-file=.env.local ./scripts/auditAffiliateFinancialIntegrity.ts` |
| `npm run audit:classification-health` | `npm run audit:classification-legacy && npm run audit:classification-quarantine && npm run audit:classification-quarantine-conflicts` |
| `npm run audit:classification-legacy` | `tsx --env-file=.env.local ./scripts/auditClassificationLegacy.ts` |
| `npm run audit:classification-quarantine` | `tsx --env-file=.env.local ./scripts/auditClassificationQuarantine.ts` |
| `npm run audit:classification-quarantine-conflicts` | `tsx --env-file=.env.local ./scripts/auditClassificationQuarantineConflicts.ts` |
| `npm run audit:collabs` | `tsx --env-file=.env.local ./scripts/auditCollabsMechanism.ts` |
| `npm run audit:hook-readiness` | `tsx --env-file=.env.local ./scripts/auditHookRecommendationReadiness.ts` |
| `npm run audit:perfil-territorio` | `tsx --env-file=.env.local ./scripts/auditPerfilTerritoryCoverage.ts` |
| `npm run audit:script-adjustment` | `tsx --env-file=.env.local ./scripts/auditScriptAdjustmentExperiment.ts` |
| `npm run audit:script-evidence` | `tsx --env-file=.env.local ./scripts/auditCreatorScriptEvidence.ts` |
| `npm run audit:video-postdates` | `node ./scripts/auditVideoPostDates.mjs` |

## backfill

| Comando | O que roda |
| --- | --- |
| `npm run backfill:classification-v2` | `tsx --env-file=.env.local ./scripts/backfillClassificationV2.ts` |
| `npm run backfill:demographics` | `tsx --env-file=.env.local ./scripts/backfillDemographicSnapshots.ts` |
| `npm run backfill:script-evidence` | `tsx --env-file=.env.local ./scripts/relatorio-semanal/backfillScenes.ts` |

## benchmark

| Comando | O que roda |
| --- | --- |
| `npm run benchmark:scripts` | `node --import tsx ./scripts/runScriptsBenchmark.ts` |
| `npm run benchmark:scripts:v3` | `tsx --env-file=.env.local ./scripts/runCreatorScriptV3Benchmark.ts` |

## billing

| Comando | O que roda |
| --- | --- |
| `npm run billing:create-d2cvip` | `node --env-file=.env.local scripts/create-d2cvip-promotion.mjs` |

## campaign-radar

| Comando | O que roda |
| --- | --- |
| `npm run campaign-radar:audit-plugin-sources` | `tsx ./scripts/campaign-radar/auditPluginDistribution.ts` |
| `npm run campaign-radar:audit-sources` | `tsx ./scripts/campaign-radar/auditSources.ts` |
| `npm run campaign-radar:collect` | `tsx ./scripts/campaign-radar/collect.ts` |
| `npm run campaign-radar:import` | `tsx --env-file=.env.local ./scripts/campaign-radar/importCatalog.ts` |
| `npm run campaign-radar:report` | `python3 ./scripts/campaign-radar/render_report.py` |
| `npm run campaign-radar:review` | `tsx ./scripts/campaign-radar/applyReview.ts` |
| `npm run campaign-radar:validate` | `python3 ./scripts/campaign-radar/validate_report.py` |

## check

| Comando | O que roda |
| --- | --- |
| `npm run check:scripts-quality` | `npm test -- --runInBand src/app/lib/scripts/ai.test.ts src/app/lib/scripts/observability.test.ts src/app/lib/scripts/promptParser.test.ts src/app/lib/scripts/intelligenceContext.test.ts src/app/lib/scripts/benchmark.test.ts src/app/lib/scripts/performanceTelemetry.test.ts && npm run benchmark:scripts` |

## classification

| Comando | O que roda |
| --- | --- |
| `npm run classification:complete-empty` | `tsx --env-file=.env.local ./scripts/completeEmptyClassifications.ts` |

## compliance

| Comando | O que roda |
| --- | --- |
| `npm run compliance:whatsapp` | `node scripts/compliance-whatsapp.mjs` |

## cron

| Comando | O que roda |
| --- | --- |
| `npm run cron:refresh-metrics` | `tsx --env-file=.env.local ./scripts/cron/refreshMetrics.ts` |

## design-system

| Comando | O que roda |
| --- | --- |
| `npm run design-system:audit` | `node scripts/audit-mobile-design-system.mjs` |

## eval

| Comando | O que roda |
| --- | --- |
| `npm run eval:mcp` | `jest --watchAll=false --runInBand src/app/lib/mcp/qualityEvals.test.ts src/app/lib/mcp/server.test.ts` |

## flag

| Comando | O que roda |
| --- | --- |
| `npm run flag:scripts-intelligence:v2` | `tsx --env-file=.env.local ./scripts/setScriptsIntelligenceFlag.ts` |
| `npm run flag:scripts-style-training:v1` | `tsx --env-file=.env.local ./scripts/setScriptsStyleTrainingFlag.ts` |

## mcp

| Comando | O que roda |
| --- | --- |
| `npm run mcp:generate-key` | `node scripts/generateMcpOAuthKey.mjs` |

## migrate

| Comando | O que roda |
| --- | --- |
| `npm run migrate:affiliate-financial-safety` | `tsx --env-file=.env.local ./scripts/migrateAffiliateFinancialSafety.ts` |
| `npm run migrate:classification-canonical` | `tsx --env-file=.env.local ./scripts/migrateCanonicalCategories.ts` |

## playwright

| Comando | O que roda |
| --- | --- |
| `npm run playwright:install-chromium` | `node scripts/install-playwright-chromium.mjs` |

## qa

| Comando | O que roda |
| --- | --- |
| `npm run qa:http` | `bash qa/http.sh` |
| `npm run qa:listen` | `bash qa/stripe-listen.sh` |
| `npm run qa:triggers` | `bash qa/stripe-triggers.sh` |

## quarantine

| Comando | O que roda |
| --- | --- |
| `npm run quarantine:classification-legacy` | `tsx --env-file=.env.local ./scripts/quarantineClassificationLegacy.ts` |

## reclassify

| Comando | O que roda |
| --- | --- |
| `npm run reclassify:strategic-residual` | `tsx --env-file=.env.local ./scripts/reclassifyStrategicResidual.ts` |

## refresh

| Comando | O que roda |
| --- | --- |
| `npm run refresh:metrics:all-users` | `tsx --env-file=.env.local ./scripts/refreshMetricsAllConnectedUsers.ts` |
| `npm run refresh:metrics:user` | `tsx --env-file=.env.local ./scripts/refreshMetricsByUser.ts` |

## relatorio

| Comando | O que roda |
| --- | --- |
| `npm run relatorio:auditar-mapa` | `tsx --env-file=.env.local ./scripts/relatorio-semanal/auditMapRegistry.ts` |
| `npm run relatorio:cenas` | `tsx --env-file=.env.local ./scripts/relatorio-semanal/backfillScenes.ts` |
| `npm run relatorio:cenas:dry-run` | `npm run relatorio:cenas -- --dry-run --limit=5` |
| `npm run relatorio:fechar` | `tsx --env-file=.env.local ./scripts/relatorio-semanal/closeWeek.ts` |
| `npm run relatorio:fechar:dry-run` | `npm run relatorio:fechar -- --dry-run` |
| `npm run relatorio:ganchos:backfill` | `tsx --env-file=.env.local ./scripts/relatorio-semanal/backfillHookPatterns.ts` |
| `npm run relatorio:render` | `tsx ./scripts/relatorio-semanal/renderSlides.ts` |

## remap

| Comando | O que roda |
| --- | --- |
| `npm run remap:classification-quarantine` | `tsx --env-file=.env.local ./scripts/remapClassificationQuarantine.ts` |

## repair

| Comando | O que roda |
| --- | --- |
| `npm run repair:affiliate-attributions` | `tsx --env-file=.env.local ./scripts/repairInvalidAffiliateAttributions.ts` |
| `npm run repair:affiliate-ledger` | `tsx --env-file=.env.local ./scripts/repairAffiliateLedger.ts` |

## requeue

| Comando | O que roda |
| --- | --- |
| `npm run requeue:classification-retryable` | `tsx --env-file=.env.local ./scripts/requeueRetryableClassificationFailures.ts` |

## sales

| Comando | O que roda |
| --- | --- |
| `npm run sales:tutorial` | `tsx --env-file=.env.local ./scripts/createSalesTutorial.ts` |
| `npm run sales:tutorial:auth` | `tsx --env-file=.env.local ./scripts/createTutorialStorageState.ts` |

## schedule

| Comando | O que roda |
| --- | --- |
| `npm run schedule:crons` | `tsx src/scripts/scheduleCrons.ts` |

## seed

| Comando | O que roda |
| --- | --- |
| `npm run seed:brand-narratives` | `tsx --env-file=.env.local ./scripts/seedBrandNarrativeProfiles.ts` |
| `npm run seed:brand-narratives:dry-run` | `npm run seed:brand-narratives -- --dry-run` |
| `npm run seed:brand-narratives:force` | `npm run seed:brand-narratives -- --force` |
| `npm run seed:brand-narratives:only-new` | `npm run seed:brand-narratives -- --only-new` |

## smoke

| Comando | O que roda |
| --- | --- |
| `npm run smoke:brand-narratives` | `tsx --env-file=.env.local ./scripts/smokeBrandNarrativeFlow.ts` |
| `npm run smoke:mcp-admin-http` | `tsx --env-file=.env.local scripts/smokeMcpAdminHttp.ts` |
| `npm run smoke:mcp-admin-integration` | `tsx --env-file=.env.local scripts/smokeMcpAdminIntegration.ts` |
| `npm run smoke:mcp-oauth` | `tsx scripts/smokeMcpOAuthCrypto.ts` |
| `npm run smoke:types` | `tsc -p tsconfig.smoke.json` |

## test

| Comando | O que roda |
| --- | --- |
| `npm run test:chatgpt-funnel` | `jest --watchAll=false --runInBand src/app/lib/mcp/conversationPolicy.test.ts src/app/dashboard/chatgpt/ready/returnUrl.test.ts src/app/dashboard/chatgpt/ready/ChatGptReturnLink.test.tsx src/app/api/dashboard/community/pro-join/route.test.ts src/app/billing/success/page.test.tsx src/app/api/billing/subscribe/route.test.ts src/app/components/CookieConsent.test.tsx src/middleware.test.ts` |
| `npm run test:demographics` | `tsx --env-file=.env.local ./scripts/testDemographics.ts` |
| `npm run test:e2e` | `playwright test` |
| `npm run test:mcp` | `jest --watchAll=false --runInBand src/app/lib/mcp` |

## typecheck

| Comando | O que roda |
| --- | --- |
| `npm run typecheck:mcp` | `tsc -p tsconfig.mcp.json` |

## update

| Comando | O que roda |
| --- | --- |
| `npm run update:cpm-seed` | `tsx --env-file=.env.local ./src/scripts/updateCpmSeed.ts` |

## video

| Comando | O que roda |
| --- | --- |
| `npm run video:narrative:real-run` | `tsx --env-file=.env.local ./scripts/video-narrative-real-run.ts` |
