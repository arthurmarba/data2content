---
gerado: automaticamente
atualizado: 2026-09-08
---

> [!warning] Nota gerada por script — não edite à mão.
> Rode `npm run brain` para atualizar. Fonte: `scripts/brain/gerar-inventario.mjs`.

# Rotas de API

O back-end vive dentro do próprio Next.js: cada pasta com um `route.ts` vira um endereço da API.

**424 rotas** em **55 grupos**.

## Índice

- [account](#account) — 1 rota
- [admin](#admin) — 102 rotas
- [ads](#ads) — 1 rota
- [affiliate](#affiliate) — 11 rotas
- [agency](#agency) — 41 rotas
- [ai](#ai) — 6 rotas
- [ai-summary](#ai-summary) — 1 rota
- [alerts](#alerts) — 3 rotas
- [analytics](#analytics) — 2 rotas
- [auth](#auth) — 4 rotas
- [billing](#billing) — 15 rotas
- [brand-narratives](#brand-narratives) — 3 rotas
- [calculator](#calculator) — 4 rotas
- [campaigns](#campaigns) — 1 rota
- [chat](#chat) — 3 rotas
- [community](#community) — 1 rota
- [creator](#creator) — 1 rota
- [cron](#cron) — 18 rotas
- [dashboard](#dashboard) — 45 rotas
- [deals](#deals) — 1 rota
- [demographics](#demographics) — 1 rota
- [dev](#dev) — 4 rotas
- [discover](#discover) — 1 rota
- [feature-flags](#feature-flags) — 1 rota
- [instagram](#instagram) — 5 rotas
- [internal](#internal) — 4 rotas
- [landing](#landing) — 5 rotas
- [mcp](#mcp) — 8 rotas
- [media](#media) — 1 rota
- [mediakit](#mediakit) — 9 rotas
- [metrics](#metrics) — 2 rotas
- [metricsHistory](#metricshistory) — 1 rota
- [og](#og) — 1 rota
- [onboarding](#onboarding) — 7 rotas
- [plan](#plan) — 6 rotas
- [planner](#planner) — 10 rotas
- [post-creation](#post-creation) — 6 rotas
- [proposals](#proposals) — 7 rotas
- [proxy](#proxy) — 2 rotas
- [public](#public) — 1 rota
- [publis](#publis) — 5 rotas
- [questions](#questions) — 1 rota
- [reports](#reports) — 1 rota
- [resolve-user-id](#resolve-user-id) — 1 rota
- [scripts](#scripts) — 5 rotas
- [stripe](#stripe) — 2 rotas
- [test-sentry](#test-sentry) — 1 rota
- [test-whatsapp](#test-whatsapp) — 1 rota
- [user](#user) — 3 rotas
- [users](#users) — 1 rota
- [v1](#v1) — 39 rotas
- [videos](#videos) — 1 rota
- [webhooks](#webhooks) — 2 rotas
- [whatsapp](#whatsapp) — 7 rotas
- [worker](#worker) — 8 rotas

## account

| Endereço | Métodos | Arquivo |
| --- | --- | --- |
| `/api/account/delete` | DELETE | `src/app/api/account/delete/route.ts` |

## admin

| Endereço | Métodos | Arquivo |
| --- | --- | --- |
| `/api/admin/affiliate/commissions/[invoiceId]/retry` | POST | `src/app/api/admin/affiliate/commissions/[invoiceId]/retry/route.ts` |
| `/api/admin/affiliates` | GET | `src/app/api/admin/affiliates/route.ts` |
| `/api/admin/affiliates/[affiliateId]/status` | PATCH | `src/app/api/admin/affiliates/[affiliateId]/status/route.ts` |
| `/api/admin/agencies` | DELETE, GET, POST, PUT | `src/app/api/admin/agencies/route.ts` |
| `/api/admin/billing/abort` | POST | `src/app/api/admin/billing/abort/route.ts` |
| `/api/admin/billing/debug` | GET | `src/app/api/admin/billing/debug/route.ts` |
| `/api/admin/billing/reconcile` | POST | `src/app/api/admin/billing/reconcile/route.ts` |
| `/api/admin/brand-proposals` | GET | `src/app/api/admin/brand-proposals/route.ts` |
| `/api/admin/brand-proposals/[proposalId]` | GET | `src/app/api/admin/brand-proposals/[proposalId]/route.ts` |
| `/api/admin/campaign-radar` | GET, POST | `src/app/api/admin/campaign-radar/route.ts` |
| `/api/admin/campaign-radar/[id]` | PATCH | `src/app/api/admin/campaign-radar/[id]/route.ts` |
| `/api/admin/campaign-radar/import` | POST | `src/app/api/admin/campaign-radar/import/route.ts` |
| `/api/admin/carousels/case-generator/drafts` | GET, POST | `src/app/api/admin/carousels/case-generator/drafts/route.ts` |
| `/api/admin/carousels/case-generator/export` | POST | `src/app/api/admin/carousels/case-generator/export/route.ts` |
| `/api/admin/carousels/case-generator/generate` | POST | `src/app/api/admin/carousels/case-generator/generate/route.ts` |
| `/api/admin/carousels/case-generator/source` | GET | `src/app/api/admin/carousels/case-generator/source/route.ts` |
| `/api/admin/chat/eval/cases` | GET, POST | `src/app/api/admin/chat/eval/cases/route.ts` |
| `/api/admin/chat/eval/run` | POST | `src/app/api/admin/chat/eval/run/route.ts` |
| `/api/admin/chat/metrics` | GET | `src/app/api/admin/chat/metrics/route.ts` |
| `/api/admin/chat/reviews/queue` | GET | `src/app/api/admin/chat/reviews/queue/route.ts` |
| `/api/admin/chat/reviews/summary` | GET | `src/app/api/admin/chat/reviews/summary/route.ts` |
| `/api/admin/chat/reviews/upsert` | POST | `src/app/api/admin/chat/reviews/upsert/route.ts` |
| `/api/admin/chat/sessions` | GET | `src/app/api/admin/chat/sessions/route.ts` |
| `/api/admin/chat/sessions/[id]` | GET | `src/app/api/admin/chat/sessions/[id]/route.ts` |
| `/api/admin/cpm-history` | GET | `src/app/api/admin/cpm-history/route.ts` |
| `/api/admin/cpm-history/snapshot` | POST | `src/app/api/admin/cpm-history/snapshot/route.ts` |
| `/api/admin/creators` | GET | `src/app/api/admin/creators/route.ts` |
| `/api/admin/creators-survey` | GET | `src/app/api/admin/creators-survey/route.ts` |
| `/api/admin/creators-survey/[creatorId]` | GET | `src/app/api/admin/creators-survey/[creatorId]/route.ts` |
| `/api/admin/creators-survey/[creatorId]/notes` | PATCH | `src/app/api/admin/creators-survey/[creatorId]/notes/route.ts` |
| `/api/admin/creators-survey/analytics` | GET | `src/app/api/admin/creators-survey/analytics/route.ts` |
| `/api/admin/creators-survey/export` | GET | `src/app/api/admin/creators-survey/export/route.ts` |
| `/api/admin/creators-survey/open-responses` | GET | `src/app/api/admin/creators-survey/open-responses/route.ts` |
| `/api/admin/creators/[creatorId]/status` | PATCH, PUT | `src/app/api/admin/creators/[creatorId]/status/route.ts` |
| `/api/admin/creators/region-summary` | GET | `src/app/api/admin/creators/region-summary/route.ts` |
| `/api/admin/dashboard-summary` | GET | `src/app/api/admin/dashboard-summary/route.ts` |
| `/api/admin/dashboard/audience/region-summary` | GET | `src/app/api/admin/dashboard/audience/region-summary/route.ts` |
| `/api/admin/dashboard/cohorts/compare` | POST | `src/app/api/admin/dashboard/cohorts/compare/route.ts` |
| `/api/admin/dashboard/content-segments/compare` | POST | `src/app/api/admin/dashboard/content-segments/compare/route.ts` |
| `/api/admin/dashboard/content-stats` | GET | `src/app/api/admin/dashboard/content-stats/route.ts` |
| `/api/admin/dashboard/content/performance-by-type` | GET | `src/app/api/admin/dashboard/content/performance-by-type/route.ts` |
| `/api/admin/dashboard/contexts` | GET | `src/app/api/admin/dashboard/contexts/route.ts` |
| `/api/admin/dashboard/creators` | GET | `src/app/api/admin/dashboard/creators/route.ts` |
| `/api/admin/dashboard/creators/[creatorId]/time-series` | GET | `src/app/api/admin/dashboard/creators/[creatorId]/time-series/route.ts` |
| `/api/admin/dashboard/creators/compare` | POST | `src/app/api/admin/dashboard/creators/compare/route.ts` |
| `/api/admin/dashboard/creators/search` | GET | `src/app/api/admin/dashboard/creators/search/route.ts` |
| `/api/admin/dashboard/demographics` | GET | `src/app/api/admin/dashboard/demographics/route.ts` |
| `/api/admin/dashboard/highlights/performance-summary` | GET | `src/app/api/admin/dashboard/highlights/performance-summary/route.ts` |
| `/api/admin/dashboard/highlights/performance-summary/batch` | GET | `src/app/api/admin/dashboard/highlights/performance-summary/batch/route.ts` |
| `/api/admin/dashboard/market-performance` | GET | `src/app/api/admin/dashboard/market-performance/route.ts` |
| `/api/admin/dashboard/performance/average-engagement` | GET | `src/app/api/admin/dashboard/performance/average-engagement/route.ts` |
| `/api/admin/dashboard/performance/time-distribution` | GET | `src/app/api/admin/dashboard/performance/time-distribution/route.ts` |
| `/api/admin/dashboard/platform-kpis/periodic-comparison` | GET | `src/app/api/admin/dashboard/platform-kpis/periodic-comparison/route.ts` |
| `/api/admin/dashboard/platform-kpis/summary` | GET | `src/app/api/admin/dashboard/platform-kpis/summary/route.ts` |
| `/api/admin/dashboard/platform-summary` | GET | `src/app/api/admin/dashboard/platform-summary/route.ts` |
| `/api/admin/dashboard/platform-summary/batch` | GET | `src/app/api/admin/dashboard/platform-summary/batch/route.ts` |
| `/api/admin/dashboard/post-reviews` | DELETE, GET, POST | `src/app/api/admin/dashboard/post-reviews/route.ts` |
| `/api/admin/dashboard/posts` | GET | `src/app/api/admin/dashboard/posts/route.ts` |
| `/api/admin/dashboard/posts/[postId]/details` | GET | `src/app/api/admin/dashboard/posts/[postId]/details/route.ts` |
| `/api/admin/dashboard/radar/effectiveness` | GET | `src/app/api/admin/dashboard/radar/effectiveness/route.ts` |
| `/api/admin/dashboard/rankings/categories` | GET | `src/app/api/admin/dashboard/rankings/categories/route.ts` |
| `/api/admin/dashboard/rankings/categories/batch` | GET | `src/app/api/admin/dashboard/rankings/categories/batch/route.ts` |
| `/api/admin/dashboard/rankings/creators/avg-engagement-per-post` | GET | `src/app/api/admin/dashboard/rankings/creators/avg-engagement-per-post/route.ts` |
| `/api/admin/dashboard/rankings/creators/avg-reach-per-post` | GET | `src/app/api/admin/dashboard/rankings/creators/avg-reach-per-post/route.ts` |
| `/api/admin/dashboard/rankings/creators/batch` | GET | `src/app/api/admin/dashboard/rankings/creators/batch/route.ts` |
| `/api/admin/dashboard/rankings/creators/engagement-growth` | GET | `src/app/api/admin/dashboard/rankings/creators/engagement-growth/route.ts` |
| `/api/admin/dashboard/rankings/creators/most-prolific` | GET | `src/app/api/admin/dashboard/rankings/creators/most-prolific/route.ts` |
| `/api/admin/dashboard/rankings/creators/performance-consistency` | GET | `src/app/api/admin/dashboard/rankings/creators/performance-consistency/route.ts` |
| `/api/admin/dashboard/rankings/creators/reach-per-follower` | GET | `src/app/api/admin/dashboard/rankings/creators/reach-per-follower/route.ts` |
| `/api/admin/dashboard/rankings/creators/top-engaging` | GET | `src/app/api/admin/dashboard/rankings/creators/top-engaging/route.ts` |
| `/api/admin/dashboard/rankings/creators/top-interactions` | GET | `src/app/api/admin/dashboard/rankings/creators/top-interactions/route.ts` |
| `/api/admin/dashboard/rankings/creators/top-sharing` | GET | `src/app/api/admin/dashboard/rankings/creators/top-sharing/route.ts` |
| `/api/admin/dashboard/rankings/proposals` | GET | `src/app/api/admin/dashboard/rankings/proposals/route.ts` |
| `/api/admin/dashboard/rankings/top-creators` | GET | `src/app/api/admin/dashboard/rankings/top-creators/route.ts` |
| `/api/admin/dashboard/rankings/top-creators/batch` | GET | `src/app/api/admin/dashboard/rankings/top-creators/batch/route.ts` |
| `/api/admin/dashboard/top-movers` | POST | `src/app/api/admin/dashboard/top-movers/route.ts` |
| `/api/admin/dashboard/trends/batch` | GET | `src/app/api/admin/dashboard/trends/batch/route.ts` |
| `/api/admin/dashboard/trends/follower-change` | GET | `src/app/api/admin/dashboard/trends/follower-change/route.ts` |
| `/api/admin/dashboard/trends/followers` | GET | `src/app/api/admin/dashboard/trends/followers/route.ts` |
| `/api/admin/dashboard/trends/moving-average-engagement` | GET | `src/app/api/admin/dashboard/trends/moving-average-engagement/route.ts` |
| `/api/admin/dashboard/trends/reach-engagement` | GET | `src/app/api/admin/dashboard/trends/reach-engagement/route.ts` |
| `/api/admin/dashboard/usage/history/[userId]` | GET | `src/app/api/admin/dashboard/usage/history/[userId]/route.ts` |
| `/api/admin/dashboard/usage/top-users` | GET | `src/app/api/admin/dashboard/usage/top-users/route.ts` |
| `/api/admin/dashboard/users/[userId]/performance/time-distribution` | GET | `src/app/api/admin/dashboard/users/[userId]/performance/time-distribution/route.ts` |
| `/api/admin/dashboard/users/[userId]/planning/batch` | GET | `src/app/api/admin/dashboard/users/[userId]/planning/batch/route.ts` |
| `/api/admin/dashboard/users/[userId]/widgets/batch` | GET | `src/app/api/admin/dashboard/users/[userId]/widgets/batch/route.ts` |
| `/api/admin/intelligence-query` | POST | `src/app/api/admin/intelligence-query/route.ts` |
| `/api/admin/maintenance/fix-subscriptions` | GET | `src/app/api/admin/maintenance/fix-subscriptions/route.ts` |
| `/api/admin/monitoring/summary` | GET | `src/app/api/admin/monitoring/summary/route.ts` |
| `/api/admin/plan-guard/metrics` | GET | `src/app/api/admin/plan-guard/metrics/route.ts` |
| `/api/admin/platform-usage` | GET | `src/app/api/admin/platform-usage/route.ts` |
| `/api/admin/post-creation/funnel/summary` | GET | `src/app/api/admin/post-creation/funnel/summary/route.ts` |
| `/api/admin/redemptions` | GET | `src/app/api/admin/redemptions/route.ts` |
| `/api/admin/redemptions/[redemptionId]/status` | PATCH | `src/app/api/admin/redemptions/[redemptionId]/status/route.ts` |
| `/api/admin/scripts/quality/cases/[id]` | GET | `src/app/api/admin/scripts/quality/cases/[id]/route.ts` |
| `/api/admin/scripts/quality/summary` | GET | `src/app/api/admin/scripts/quality/summary/route.ts` |
| `/api/admin/seed-usage` | GET | `src/app/api/admin/seed-usage/route.ts` |
| `/api/admin/users/[userId]/generate-media-kit-token` | GET, POST | `src/app/api/admin/users/[userId]/generate-media-kit-token/route.ts` |
| `/api/admin/users/[userId]/media-kit-token` | DELETE | `src/app/api/admin/users/[userId]/media-kit-token/route.ts` |
| `/api/admin/users/[userId]/role` | PATCH | `src/app/api/admin/users/[userId]/role/route.ts` |
| `/api/admin/users/convert-guest` | POST | `src/app/api/admin/users/convert-guest/route.ts` |
| `/api/admin/users/search` | GET | `src/app/api/admin/users/search/route.ts` |

## ads

| Endereço | Métodos | Arquivo |
| --- | --- | --- |
| `/api/ads` | GET, POST | `src/app/api/ads/route.ts` |

## affiliate

| Endereço | Métodos | Arquivo |
| --- | --- | --- |
| `/api/affiliate` | GET, POST | `src/app/api/affiliate/route.ts` |
| `/api/affiliate/balances` | GET | `src/app/api/affiliate/balances/route.ts` |
| `/api/affiliate/commission-log` | GET | `src/app/api/affiliate/commission-log/route.ts` |
| `/api/affiliate/connect/create` | POST | `src/app/api/affiliate/connect/create/route.ts` |
| `/api/affiliate/connect/link` | POST | `src/app/api/affiliate/connect/link/route.ts` |
| `/api/affiliate/connect/onboard` | POST | `src/app/api/affiliate/connect/onboard/route.ts` |
| `/api/affiliate/connect/status` | GET | `src/app/api/affiliate/connect/status/route.ts` |
| `/api/affiliate/cron/mature` | POST | `src/app/api/affiliate/cron/mature/route.ts` |
| `/api/affiliate/history` | GET | `src/app/api/affiliate/history/route.ts` |
| `/api/affiliate/redeem` | POST | `src/app/api/affiliate/redeem/route.ts` |
| `/api/affiliate/summary` | GET | `src/app/api/affiliate/summary/route.ts` |

## agency

| Endereço | Métodos | Arquivo |
| --- | --- | --- |
| `/api/agency/accept-invite` | POST | `src/app/api/agency/accept-invite/route.ts` |
| `/api/agency/creators/region-summary` | GET | `src/app/api/agency/creators/region-summary/route.ts` |
| `/api/agency/dashboard/contexts` | GET | `src/app/api/agency/dashboard/contexts/route.ts` |
| `/api/agency/dashboard/creators` | GET | `src/app/api/agency/dashboard/creators/route.ts` |
| `/api/agency/dashboard/demographics` | GET | `src/app/api/agency/dashboard/demographics/route.ts` |
| `/api/agency/dashboard/highlights/performance-summary` | GET | `src/app/api/agency/dashboard/highlights/performance-summary/route.ts` |
| `/api/agency/dashboard/highlights/performance-summary/batch` | GET | `src/app/api/agency/dashboard/highlights/performance-summary/batch/route.ts` |
| `/api/agency/dashboard/performance/average-engagement` | GET | `src/app/api/agency/dashboard/performance/average-engagement/route.ts` |
| `/api/agency/dashboard/performance/time-distribution` | GET | `src/app/api/agency/dashboard/performance/time-distribution/route.ts` |
| `/api/agency/dashboard/platform-kpis/periodic-comparison` | GET | `src/app/api/agency/dashboard/platform-kpis/periodic-comparison/route.ts` |
| `/api/agency/dashboard/platform-kpis/summary` | GET | `src/app/api/agency/dashboard/platform-kpis/summary/route.ts` |
| `/api/agency/dashboard/platform-summary` | GET | `src/app/api/agency/dashboard/platform-summary/route.ts` |
| `/api/agency/dashboard/posts` | GET | `src/app/api/agency/dashboard/posts/route.ts` |
| `/api/agency/dashboard/posts/[postId]/details` | GET | `src/app/api/agency/dashboard/posts/[postId]/details/route.ts` |
| `/api/agency/dashboard/rankings/creators/avg-engagement-per-post` | GET | `src/app/api/agency/dashboard/rankings/creators/avg-engagement-per-post/route.ts` |
| `/api/agency/dashboard/rankings/creators/avg-reach-per-post` | GET | `src/app/api/agency/dashboard/rankings/creators/avg-reach-per-post/route.ts` |
| `/api/agency/dashboard/rankings/creators/engagement-growth` | GET | `src/app/api/agency/dashboard/rankings/creators/engagement-growth/route.ts` |
| `/api/agency/dashboard/rankings/creators/most-prolific` | GET | `src/app/api/agency/dashboard/rankings/creators/most-prolific/route.ts` |
| `/api/agency/dashboard/rankings/creators/performance-consistency` | GET | `src/app/api/agency/dashboard/rankings/creators/performance-consistency/route.ts` |
| `/api/agency/dashboard/rankings/creators/reach-per-follower` | GET | `src/app/api/agency/dashboard/rankings/creators/reach-per-follower/route.ts` |
| `/api/agency/dashboard/rankings/creators/top-engaging` | GET | `src/app/api/agency/dashboard/rankings/creators/top-engaging/route.ts` |
| `/api/agency/dashboard/rankings/creators/top-interactions` | GET | `src/app/api/agency/dashboard/rankings/creators/top-interactions/route.ts` |
| `/api/agency/dashboard/rankings/creators/top-sharing` | GET | `src/app/api/agency/dashboard/rankings/creators/top-sharing/route.ts` |
| `/api/agency/dashboard/rankings/top-creators` | GET | `src/app/api/agency/dashboard/rankings/top-creators/route.ts` |
| `/api/agency/dashboard/top-movers` | POST | `src/app/api/agency/dashboard/top-movers/route.ts` |
| `/api/agency/dashboard/trends/follower-change` | GET | `src/app/api/agency/dashboard/trends/follower-change/route.ts` |
| `/api/agency/dashboard/trends/followers` | GET | `src/app/api/agency/dashboard/trends/followers/route.ts` |
| `/api/agency/dashboard/trends/moving-average-engagement` | GET | `src/app/api/agency/dashboard/trends/moving-average-engagement/route.ts` |
| `/api/agency/dashboard/trends/reach-engagement` | GET | `src/app/api/agency/dashboard/trends/reach-engagement/route.ts` |
| `/api/agency/dashboard/users/[userId]/performance/time-distribution` | GET | `src/app/api/agency/dashboard/users/[userId]/performance/time-distribution/route.ts` |
| `/api/agency/guests` | GET | `src/app/api/agency/guests/route.ts` |
| `/api/agency/info/[inviteCode]` | GET | `src/app/api/agency/info/[inviteCode]/route.ts` |
| `/api/agency/invite-code` | GET | `src/app/api/agency/invite-code/route.ts` |
| `/api/agency/profile` | GET | `src/app/api/agency/profile/route.ts` |
| `/api/agency/register` | POST | `src/app/api/agency/register/route.ts` |
| `/api/agency/subscription/cancel` | POST | `src/app/api/agency/subscription/cancel/route.ts` |
| `/api/agency/subscription/create-checkout` | POST | `src/app/api/agency/subscription/create-checkout/route.ts` |
| `/api/agency/subscription/manage-portal` | POST | `src/app/api/agency/subscription/manage-portal/route.ts` |
| `/api/agency/subscription/webhook` | POST | `src/app/api/agency/subscription/webhook/route.ts` |
| `/api/agency/summary` | GET | `src/app/api/agency/summary/route.ts` |
| `/api/agency/users/search` | GET | `src/app/api/agency/users/search/route.ts` |

## ai

| Endereço | Métodos | Arquivo |
| --- | --- | --- |
| `/api/ai/chat` | POST | `src/app/api/ai/chat/route.ts` |
| `/api/ai/chat/threads` | GET, POST | `src/app/api/ai/chat/threads/route.ts` |
| `/api/ai/chat/threads/[threadId]` | DELETE, GET, PATCH | `src/app/api/ai/chat/threads/[threadId]/route.ts` |
| `/api/ai/dynamicCards` | POST | `src/app/api/ai/dynamicCards/route.ts` |
| `/api/ai/insights` | GET | `src/app/api/ai/insights/route.ts` |
| `/api/ai/pricing-analysis` | POST | `src/app/api/ai/pricing-analysis/route.ts` |

## ai-summary

| Endereço | Métodos | Arquivo |
| --- | --- | --- |
| `/api/ai-summary` | GET | `src/app/api/ai-summary/route.ts` |

## alerts

| Endereço | Métodos | Arquivo |
| --- | --- | --- |
| `/api/alerts` | GET | `src/app/api/alerts/route.ts` |
| `/api/alerts/[alertId]/mark-read` | PATCH | `src/app/api/alerts/[alertId]/mark-read/route.ts` |
| `/api/alerts/unread-count` | GET | `src/app/api/alerts/unread-count/route.ts` |

## analytics

| Endereço | Métodos | Arquivo |
| --- | --- | --- |
| `/api/analytics/context` | GET | `src/app/api/analytics/context/route.ts` |
| `/api/analytics/openai-conversion` | POST | `src/app/api/analytics/openai-conversion/route.ts` |

## auth

| Endereço | Métodos | Arquivo |
| --- | --- | --- |
| `/api/auth/[...nextauth]` | — | `src/app/api/auth/[...nextauth]/route.ts` |
| `/api/auth/accept-terms` | POST | `src/app/api/auth/accept-terms/route.ts` |
| `/api/auth/delete-user-data` | GET, POST | `src/app/api/auth/delete-user-data/route.ts` |
| `/api/auth/iniciar-vinculacao-fb` | POST | `src/app/api/auth/iniciar-vinculacao-fb/route.ts` |

## billing

| Endereço | Métodos | Arquivo |
| --- | --- | --- |
| `/api/billing/abort` | POST | `src/app/api/billing/abort/route.ts` |
| `/api/billing/cancel` | POST | `src/app/api/billing/cancel/route.ts` |
| `/api/billing/change-plan` | POST | `src/app/api/billing/change-plan/route.ts` |
| `/api/billing/checkout-context` | GET | `src/app/api/billing/checkout-context/route.ts` |
| `/api/billing/checkout/trial` | POST | `src/app/api/billing/checkout/trial/route.ts` |
| `/api/billing/portal` | POST | `src/app/api/billing/portal/route.ts` |
| `/api/billing/preview` | POST | `src/app/api/billing/preview/route.ts` |
| `/api/billing/preview-plan-change` | POST | `src/app/api/billing/preview-plan-change/route.ts` |
| `/api/billing/prices` | GET | `src/app/api/billing/prices/route.ts` |
| `/api/billing/reactivate` | POST | `src/app/api/billing/reactivate/route.ts` |
| `/api/billing/resume` | POST | `src/app/api/billing/resume/route.ts` |
| `/api/billing/status` | GET | `src/app/api/billing/status/route.ts` |
| `/api/billing/subscribe` | POST | `src/app/api/billing/subscribe/route.ts` |
| `/api/billing/subscription` | GET | `src/app/api/billing/subscription/route.ts` |
| `/api/billing/tax-id` | GET, POST | `src/app/api/billing/tax-id/route.ts` |

## brand-narratives

| Endereço | Métodos | Arquivo |
| --- | --- | --- |
| `/api/brand-narratives/match` | POST | `src/app/api/brand-narratives/match/route.ts` |
| `/api/brand-narratives/reports` | POST | `src/app/api/brand-narratives/reports/route.ts` |
| `/api/brand-narratives/reports/[slug]` | GET | `src/app/api/brand-narratives/reports/[slug]/route.ts` |

## calculator

| Endereço | Métodos | Arquivo |
| --- | --- | --- |
| `/api/calculator` | GET, POST | `src/app/api/calculator/route.ts` |
| `/api/calculator/[id]` | GET, PATCH | `src/app/api/calculator/[id]/route.ts` |
| `/api/calculator/latest` | GET | `src/app/api/calculator/latest/route.ts` |
| `/api/calculator/personal-reference` | DELETE, GET, PATCH | `src/app/api/calculator/personal-reference/route.ts` |

## campaigns

| Endereço | Métodos | Arquivo |
| --- | --- | --- |
| `/api/campaigns/new` | POST | `src/app/api/campaigns/new/route.ts` |

## chat

| Endereço | Métodos | Arquivo |
| --- | --- | --- |
| `/api/chat/feedback/csat-prompt` | POST | `src/app/api/chat/feedback/csat-prompt/route.ts` |
| `/api/chat/feedback/message` | POST | `src/app/api/chat/feedback/message/route.ts` |
| `/api/chat/feedback/session` | GET, POST | `src/app/api/chat/feedback/session/route.ts` |

## community

| Endereço | Métodos | Arquivo |
| --- | --- | --- |
| `/api/community/meeting/calendar` | GET | `src/app/api/community/meeting/calendar/route.ts` |

## creator

| Endereço | Métodos | Arquivo |
| --- | --- | --- |
| `/api/creator/profile-extended` | GET, PATCH | `src/app/api/creator/profile-extended/route.ts` |

## cron

| Endereço | Métodos | Arquivo |
| --- | --- | --- |
| `/api/cron/backfill-post-covers` | POST | `src/app/api/cron/backfill-post-covers/route.ts` |
| `/api/cron/campaign-radar` | GET | `src/app/api/cron/campaign-radar/route.ts` |
| `/api/cron/creator-weekly-reports` | GET, POST | `src/app/api/cron/creator-weekly-reports/route.ts` |
| `/api/cron/expire-trials` | POST | `src/app/api/cron/expire-trials/route.ts` |
| `/api/cron/mature-affiliate-commissions` | POST | `src/app/api/cron/mature-affiliate-commissions/route.ts` |
| `/api/cron/notify-free-month-ending` | POST | `src/app/api/cron/notify-free-month-ending/route.ts` |
| `/api/cron/persist-usage-counters` | POST | `src/app/api/cron/persist-usage-counters/route.ts` |
| `/api/cron/populate-community-inspirations` | POST | `src/app/api/cron/populate-community-inspirations/route.ts` |
| `/api/cron/recover-content-intelligence` | GET, POST | `src/app/api/cron/recover-content-intelligence/route.ts` |
| `/api/cron/refresh-instagram-data` | POST | `src/app/api/cron/refresh-instagram-data/route.ts` |
| `/api/cron/regenerate-content-ideas` | GET, POST | `src/app/api/cron/regenerate-content-ideas/route.ts` |
| `/api/cron/send-daily-tips` | POST | `src/app/api/cron/send-daily-tips/route.ts` |
| `/api/cron/weekly-map-summary` | GET, POST | `src/app/api/cron/weekly-map-summary/route.ts` |
| `/api/cron/weekly-mapa-whatsapp` | GET, POST | `src/app/api/cron/weekly-mapa-whatsapp/route.ts` |
| `/api/cron/weekly-report-close` | GET, POST | `src/app/api/cron/weekly-report-close/route.ts` |
| `/api/cron/weekly-scene-evaluation` | GET, POST | `src/app/api/cron/weekly-scene-evaluation/route.ts` |
| `/api/cron/weekly-whatsapp-message` | GET, POST | `src/app/api/cron/weekly-whatsapp-message/route.ts` |
| `/api/cron/whatsapp-trial` | GET, POST | `src/app/api/cron/whatsapp-trial/route.ts` |

## dashboard

| Endereço | Métodos | Arquivo |
| --- | --- | --- |
| `/api/dashboard/community/free-join` | GET | `src/app/api/dashboard/community/free-join/route.ts` |
| `/api/dashboard/community/pro-join` | GET | `src/app/api/dashboard/community/pro-join/route.ts` |
| `/api/dashboard/community/vip-join-confirmation` | POST | `src/app/api/dashboard/community/vip-join-confirmation/route.ts` |
| `/api/dashboard/home/summary` | GET | `src/app/api/dashboard/home/summary/route.ts` |
| `/api/dashboard/mobile-strategic-profile/analyses/[id]/thumbnail` | GET, POST | `src/app/api/dashboard/mobile-strategic-profile/analyses/[id]/thumbnail/route.ts` |
| `/api/dashboard/mobile-strategic-profile/analyze` | GET, POST | `src/app/api/dashboard/mobile-strategic-profile/analyze/route.ts` |
| `/api/dashboard/mobile-strategic-profile/analyze-real` | DELETE, GET, PATCH, POST, PUT | `src/app/api/dashboard/mobile-strategic-profile/analyze-real/route.ts` |
| `/api/dashboard/mobile-strategic-profile/collabs/creators/[creatorId]/avatar` | GET | `src/app/api/dashboard/mobile-strategic-profile/collabs/creators/[creatorId]/avatar/route.ts` |
| `/api/dashboard/mobile-strategic-profile/collabs/interest` | GET, PATCH, POST | `src/app/api/dashboard/mobile-strategic-profile/collabs/interest/route.ts` |
| `/api/dashboard/mobile-strategic-profile/collabs/per-pauta` | POST | `src/app/api/dashboard/mobile-strategic-profile/collabs/per-pauta/route.ts` |
| `/api/dashboard/mobile-strategic-profile/collabs/suggestions` | POST | `src/app/api/dashboard/mobile-strategic-profile/collabs/suggestions/route.ts` |
| `/api/dashboard/mobile-strategic-profile/confirm-map-dimension` | DELETE, GET, PATCH, POST, PUT | `src/app/api/dashboard/mobile-strategic-profile/confirm-map-dimension/route.ts` |
| `/api/dashboard/mobile-strategic-profile/content-ideas` | DELETE, GET, PATCH, POST, PUT | `src/app/api/dashboard/mobile-strategic-profile/content-ideas/route.ts` |
| `/api/dashboard/mobile-strategic-profile/content-ideas/[id]` | DELETE, GET, PATCH, POST, PUT | `src/app/api/dashboard/mobile-strategic-profile/content-ideas/[id]/route.ts` |
| `/api/dashboard/mobile-strategic-profile/content-ideas/generate` | DELETE, GET, PATCH, POST, PUT | `src/app/api/dashboard/mobile-strategic-profile/content-ideas/generate/route.ts` |
| `/api/dashboard/mobile-strategic-profile/diagnosis/[id]/content-potential-feedback` | DELETE, GET, PATCH, POST, PUT | `src/app/api/dashboard/mobile-strategic-profile/diagnosis/[id]/content-potential-feedback/route.ts` |
| `/api/dashboard/mobile-strategic-profile/diagnosis/[id]/hook-selection` | DELETE, GET, PATCH, POST, PUT | `src/app/api/dashboard/mobile-strategic-profile/diagnosis/[id]/hook-selection/route.ts` |
| `/api/dashboard/mobile-strategic-profile/diagnosis/[id]/publish-intent` | DELETE, GET, PATCH, POST, PUT | `src/app/api/dashboard/mobile-strategic-profile/diagnosis/[id]/publish-intent/route.ts` |
| `/api/dashboard/mobile-strategic-profile/diagnosis/[id]/script-adjustment-selection` | DELETE, GET, PATCH, POST, PUT | `src/app/api/dashboard/mobile-strategic-profile/diagnosis/[id]/script-adjustment-selection/route.ts` |
| `/api/dashboard/mobile-strategic-profile/last-map-visit` | DELETE, GET, PATCH, POST, PUT | `src/app/api/dashboard/mobile-strategic-profile/last-map-visit/route.ts` |
| `/api/dashboard/mobile-strategic-profile/map-seed` | DELETE, GET, PATCH, POST, PUT | `src/app/api/dashboard/mobile-strategic-profile/map-seed/route.ts` |
| `/api/dashboard/mobile-strategic-profile/map/confirm-adjacent` | DELETE, GET, PATCH, POST, PUT | `src/app/api/dashboard/mobile-strategic-profile/map/confirm-adjacent/route.ts` |
| `/api/dashboard/mobile-strategic-profile/map/confirm-formats` | POST | `src/app/api/dashboard/mobile-strategic-profile/map/confirm-formats/route.ts` |
| `/api/dashboard/mobile-strategic-profile/map/detect-adjacent-narratives` | DELETE, GET, PATCH, POST, PUT | `src/app/api/dashboard/mobile-strategic-profile/map/detect-adjacent-narratives/route.ts` |
| `/api/dashboard/mobile-strategic-profile/map/endorse-hypothesis` | POST | `src/app/api/dashboard/mobile-strategic-profile/map/endorse-hypothesis/route.ts` |
| `/api/dashboard/mobile-strategic-profile/onboarding` | DELETE, GET, PATCH, POST, PUT | `src/app/api/dashboard/mobile-strategic-profile/onboarding/route.ts` |
| `/api/dashboard/mobile-strategic-profile/onboarding-answers` | PATCH | `src/app/api/dashboard/mobile-strategic-profile/onboarding-answers/route.ts` |
| `/api/dashboard/mobile-strategic-profile/onboarding/map-profile` | POST | `src/app/api/dashboard/mobile-strategic-profile/onboarding/map-profile/route.ts` |
| `/api/dashboard/mobile-strategic-profile/pattern-context` | GET | `src/app/api/dashboard/mobile-strategic-profile/pattern-context/route.ts` |
| `/api/dashboard/mobile-strategic-profile/pricing-profile` | POST | `src/app/api/dashboard/mobile-strategic-profile/pricing-profile/route.ts` |
| `/api/dashboard/mobile-strategic-profile/reading/[diagnosisId]` | GET, PATCH | `src/app/api/dashboard/mobile-strategic-profile/reading/[diagnosisId]/route.ts` |
| `/api/dashboard/mobile-strategic-profile/territory-trends` | GET | `src/app/api/dashboard/mobile-strategic-profile/territory-trends/route.ts` |
| `/api/dashboard/mobile-strategic-profile/upload-cleanup` | DELETE, GET, PATCH, POST, PUT | `src/app/api/dashboard/mobile-strategic-profile/upload-cleanup/route.ts` |
| `/api/dashboard/mobile-strategic-profile/upload-session` | DELETE, GET, PATCH, POST, PUT | `src/app/api/dashboard/mobile-strategic-profile/upload-session/route.ts` |
| `/api/dashboard/mobile-strategic-profile/weekly-report` | GET, POST | `src/app/api/dashboard/mobile-strategic-profile/weekly-report/route.ts` |
| `/api/dashboard/notifications/badges` | GET | `src/app/api/dashboard/notifications/badges/route.ts` |
| `/api/dashboard/post-reviews` | GET | `src/app/api/dashboard/post-reviews/route.ts` |
| `/api/dashboard/post-reviews/unread-count` | GET | `src/app/api/dashboard/post-reviews/unread-count/route.ts` |
| `/api/dashboard/pricing-stats/narrative-range` | GET | `src/app/api/dashboard/pricing-stats/narrative-range/route.ts` |
| `/api/dashboard/proposals/proposal-link-copied` | POST | `src/app/api/dashboard/proposals/proposal-link-copied/route.ts` |
| `/api/dashboard/recorded-meetings` | GET | `src/app/api/dashboard/recorded-meetings/route.ts` |
| `/api/dashboard/recorded-meetings/[id]/playback` | GET | `src/app/api/dashboard/recorded-meetings/[id]/playback/route.ts` |
| `/api/dashboard/recorded-meetings/[id]/thumbnail` | GET | `src/app/api/dashboard/recorded-meetings/[id]/thumbnail/route.ts` |
| `/api/dashboard/strategic-map/full` | GET | `src/app/api/dashboard/strategic-map/full/route.ts` |
| `/api/dashboard/strategic-map/summary` | GET | `src/app/api/dashboard/strategic-map/summary/route.ts` |

## deals

| Endereço | Métodos | Arquivo |
| --- | --- | --- |
| `/api/deals/recent` | GET | `src/app/api/deals/recent/route.ts` |

## demographics

| Endereço | Métodos | Arquivo |
| --- | --- | --- |
| `/api/demographics/[userId]` | GET | `src/app/api/demographics/[userId]/route.ts` |

## dev

| Endereço | Métodos | Arquivo |
| --- | --- | --- |
| `/api/dev/e2e/ensure-planner-access` | POST | `src/app/api/dev/e2e/ensure-planner-access/route.ts` |
| `/api/dev/e2e/scripts-fixture` | POST | `src/app/api/dev/e2e/scripts-fixture/route.ts` |
| `/api/dev/mobile-strategic-profile/discard-upload` | GET, POST, PUT | `src/app/api/dev/mobile-strategic-profile/discard-upload/route.ts` |
| `/api/dev/test-permissions` | GET | `src/app/api/dev/test-permissions/route.ts` |

## discover

| Endereço | Métodos | Arquivo |
| --- | --- | --- |
| `/api/discover/feed` | GET | `src/app/api/discover/feed/route.ts` |

## feature-flags

| Endereço | Métodos | Arquivo |
| --- | --- | --- |
| `/api/feature-flags` | GET, PATCH | `src/app/api/feature-flags/route.ts` |

## instagram

| Endereço | Métodos | Arquivo |
| --- | --- | --- |
| `/api/instagram/[userId]/demographics` | GET | `src/app/api/instagram/[userId]/demographics/route.ts` |
| `/api/instagram/connect-selected-account` | POST | `src/app/api/instagram/connect-selected-account/route.ts` |
| `/api/instagram/disconnect` | POST | `src/app/api/instagram/disconnect/route.ts` |
| `/api/instagram/fetch-media` | GET | `src/app/api/instagram/fetch-media/route.ts` |
| `/api/instagram/status` | GET | `src/app/api/instagram/status/route.ts` |

## internal

| Endereço | Métodos | Arquivo |
| --- | --- | --- |
| `/api/internal/affiliate/health` | GET | `src/app/api/internal/affiliate/health/route.ts` |
| `/api/internal/affiliate/mature` | POST | `src/app/api/internal/affiliate/mature/route.ts` |
| `/api/internal/video-narrative/analyze` | DELETE, GET, PATCH, POST, PUT | `src/app/api/internal/video-narrative/analyze/route.ts` |
| `/api/internal/video-narrative/gemini-smoke` | GET, POST | `src/app/api/internal/video-narrative/gemini-smoke/route.ts` |

## landing

| Endereço | Métodos | Arquivo |
| --- | --- | --- |
| `/api/landing/casting` | GET | `src/app/api/landing/casting/route.ts` |
| `/api/landing/community-stats` | GET | `src/app/api/landing/community-stats/route.ts` |
| `/api/landing/coverage/geography` | GET | `src/app/api/landing/coverage/geography/route.ts` |
| `/api/landing/coverage/segments` | GET | `src/app/api/landing/coverage/segments/route.ts` |
| `/api/landing/discovery` | GET | `src/app/api/landing/discovery/route.ts` |

## mcp

| Endereço | Métodos | Arquivo |
| --- | --- | --- |
| `/api/mcp` | DELETE, GET, OPTIONS, POST | `src/app/api/mcp/route.ts` |
| `/api/mcp/admin` | DELETE, GET, OPTIONS, POST | `src/app/api/mcp/admin/route.ts` |
| `/api/mcp/health` | GET | `src/app/api/mcp/health/route.ts` |
| `/api/mcp/oauth/authorize` | GET, POST | `src/app/api/mcp/oauth/authorize/route.ts` |
| `/api/mcp/oauth/jwks` | GET | `src/app/api/mcp/oauth/jwks/route.ts` |
| `/api/mcp/oauth/register` | POST | `src/app/api/mcp/oauth/register/route.ts` |
| `/api/mcp/oauth/revoke` | POST | `src/app/api/mcp/oauth/revoke/route.ts` |
| `/api/mcp/oauth/token` | POST | `src/app/api/mcp/oauth/token/route.ts` |

## media

| Endereço | Métodos | Arquivo |
| --- | --- | --- |
| `/api/media/cover/[id]` | GET, HEAD | `src/app/api/media/cover/[id]/route.ts` |

## mediakit

| Endereço | Métodos | Arquivo |
| --- | --- | --- |
| `/api/mediakit/[token]/avatar` | GET | `src/app/api/mediakit/[token]/avatar/route.ts` |
| `/api/mediakit/[token]/og-image` | GET | `src/app/api/mediakit/[token]/og-image/route.ts` |
| `/api/mediakit/[token]/pdf` | GET | `src/app/api/mediakit/[token]/pdf/route.ts` |
| `/api/mediakit/[token]/proposals` | POST | `src/app/api/mediakit/[token]/proposals/route.ts` |
| `/api/mediakit/[token]/view-data` | GET | `src/app/api/mediakit/[token]/view-data/route.ts` |
| `/api/mediakit/access` | POST | `src/app/api/mediakit/access/route.ts` |
| `/api/mediakit/self/packages` | DELETE, GET, POST | `src/app/api/mediakit/self/packages/route.ts` |
| `/api/mediakit/self/pricing` | DELETE, GET, PATCH | `src/app/api/mediakit/self/pricing/route.ts` |
| `/api/mediakit/self/user` | GET, PATCH | `src/app/api/mediakit/self/user/route.ts` |

## metrics

| Endereço | Métodos | Arquivo |
| --- | --- | --- |
| `/api/metrics` | POST | `src/app/api/metrics/route.ts` |
| `/api/metrics/[metricId]/daily` | GET | `src/app/api/metrics/[metricId]/daily/route.ts` |

## metricsHistory

| Endereço | Métodos | Arquivo |
| --- | --- | --- |
| `/api/metricsHistory` | GET | `src/app/api/metricsHistory/route.ts` |

## og

| Endereço | Métodos | Arquivo |
| --- | --- | --- |
| `/api/og/home` | GET | `src/app/api/og/home/route.ts` |

## onboarding

| Endereço | Métodos | Arquivo |
| --- | --- | --- |
| `/api/onboarding/instagram-enrich` | GET, POST | `src/app/api/onboarding/instagram-enrich/route.ts` |
| `/api/onboarding/leitura-inaugural` | GET, POST | `src/app/api/onboarding/leitura-inaugural/route.ts` |
| `/api/onboarding/mapa-seed/generate` | GET, POST | `src/app/api/onboarding/mapa-seed/generate/route.ts` |
| `/api/onboarding/pautas/[id]` | GET, PATCH | `src/app/api/onboarding/pautas/[id]/route.ts` |
| `/api/onboarding/status` | GET | `src/app/api/onboarding/status/route.ts` |
| `/api/onboarding/video-analyze` | GET, POST | `src/app/api/onboarding/video-analyze/route.ts` |
| `/api/onboarding/video-declare` | GET, POST | `src/app/api/onboarding/video-declare/route.ts` |

## plan

| Endereço | Métodos | Arquivo |
| --- | --- | --- |
| `/api/plan/cancel` | POST | `src/app/api/plan/cancel/route.ts` |
| `/api/plan/last-error` | GET | `src/app/api/plan/last-error/route.ts` |
| `/api/plan/status` | GET | `src/app/api/plan/status/route.ts` |
| `/api/plan/subscribe` | POST | `src/app/api/plan/subscribe/route.ts` |
| `/api/plan/subscribe-one-time` | POST | `src/app/api/plan/subscribe-one-time/route.ts` |
| `/api/plan/webhook` | POST | `src/app/api/plan/webhook/route.ts` |

## planner

| Endereço | Métodos | Arquivo |
| --- | --- | --- |
| `/api/planner/batch` | GET | `src/app/api/planner/batch/route.ts` |
| `/api/planner/collab-creators` | POST | `src/app/api/planner/collab-creators/route.ts` |
| `/api/planner/generate` | POST | `src/app/api/planner/generate/route.ts` |
| `/api/planner/inspirations` | POST | `src/app/api/planner/inspirations/route.ts` |
| `/api/planner/inspirations/community` | POST | `src/app/api/planner/inspirations/community/route.ts` |
| `/api/planner/pautas` | POST | `src/app/api/planner/pautas/route.ts` |
| `/api/planner/plan` | GET, POST | `src/app/api/planner/plan/route.ts` |
| `/api/planner/public` | GET | `src/app/api/planner/public/route.ts` |
| `/api/planner/recommendations` | GET | `src/app/api/planner/recommendations/route.ts` |
| `/api/planner/themes` | POST | `src/app/api/planner/themes/route.ts` |

## post-creation

| Endereço | Métodos | Arquivo |
| --- | --- | --- |
| `/api/post-creation/drafts` | GET, POST | `src/app/api/post-creation/drafts/route.ts` |
| `/api/post-creation/drafts/[id]` | GET, PATCH | `src/app/api/post-creation/drafts/[id]/route.ts` |
| `/api/post-creation/events` | POST | `src/app/api/post-creation/events/route.ts` |
| `/api/post-creation/events/summary` | GET | `src/app/api/post-creation/events/summary/route.ts` |
| `/api/post-creation/trial/start` | POST | `src/app/api/post-creation/trial/start/route.ts` |
| `/api/post-creation/trial/status` | GET | `src/app/api/post-creation/trial/status/route.ts` |

## proposals

| Endereço | Métodos | Arquivo |
| --- | --- | --- |
| `/api/proposals` | GET | `src/app/api/proposals/route.ts` |
| `/api/proposals/[id]` | GET, PATCH | `src/app/api/proposals/[id]/route.ts` |
| `/api/proposals/[id]/analyze` | POST | `src/app/api/proposals/[id]/analyze/route.ts` |
| `/api/proposals/[id]/links` | GET, POST | `src/app/api/proposals/[id]/links/route.ts` |
| `/api/proposals/[id]/links/[linkId]` | DELETE, PATCH | `src/app/api/proposals/[id]/links/[linkId]/route.ts` |
| `/api/proposals/[id]/notify-upgrade` | POST | `src/app/api/proposals/[id]/notify-upgrade/route.ts` |
| `/api/proposals/[id]/reply` | POST | `src/app/api/proposals/[id]/reply/route.ts` |

## proxy

| Endereço | Métodos | Arquivo |
| --- | --- | --- |
| `/api/proxy/thumbnail/[...path]` | GET | `src/app/api/proxy/thumbnail/[...path]/route.ts` |
| `/api/proxy/video/[...path]` | GET | `src/app/api/proxy/video/[...path]/route.ts` |

## public

| Endereço | Métodos | Arquivo |
| --- | --- | --- |
| `/api/public/publis/[token]` | GET | `src/app/api/public/publis/[token]/route.ts` |

## publis

| Endereço | Métodos | Arquivo |
| --- | --- | --- |
| `/api/publis` | GET | `src/app/api/publis/route.ts` |
| `/api/publis/[id]` | GET | `src/app/api/publis/[id]/route.ts` |
| `/api/publis/[id]/override` | POST | `src/app/api/publis/[id]/override/route.ts` |
| `/api/publis/[id]/share` | POST | `src/app/api/publis/[id]/share/route.ts` |
| `/api/publis/[id]/share/revoke` | POST | `src/app/api/publis/[id]/share/revoke/route.ts` |

## questions

| Endereço | Métodos | Arquivo |
| --- | --- | --- |
| `/api/questions` | GET | `src/app/api/questions/route.ts` |

## reports

| Endereço | Métodos | Arquivo |
| --- | --- | --- |
| `/api/reports/strategic/[userId]` | GET, POST | `src/app/api/reports/strategic/[userId]/route.ts` |

## resolve-user-id

| Endereço | Métodos | Arquivo |
| --- | --- | --- |
| `/api/resolve-user-id` | GET | `src/app/api/resolve-user-id/route.ts` |

## scripts

| Endereço | Métodos | Arquivo |
| --- | --- | --- |
| `/api/scripts` | GET, POST | `src/app/api/scripts/route.ts` |
| `/api/scripts/[id]` | DELETE, GET, PATCH | `src/app/api/scripts/[id]/route.ts` |
| `/api/scripts/[id]/ai-adjust` | POST | `src/app/api/scripts/[id]/ai-adjust/route.ts` |
| `/api/scripts/content-options` | GET | `src/app/api/scripts/content-options/route.ts` |
| `/api/scripts/unread-count` | GET | `src/app/api/scripts/unread-count/route.ts` |

## stripe

| Endereço | Métodos | Arquivo |
| --- | --- | --- |
| `/api/stripe/connect-webhook` | POST | `src/app/api/stripe/connect-webhook/route.ts` |
| `/api/stripe/webhook` | POST | `src/app/api/stripe/webhook/route.ts` |

## test-sentry

| Endereço | Métodos | Arquivo |
| --- | --- | --- |
| `/api/test-sentry` | GET | `src/app/api/test-sentry/route.ts` |

## test-whatsapp

| Endereço | Métodos | Arquivo |
| --- | --- | --- |
| `/api/test-whatsapp` | GET | `src/app/api/test-whatsapp/route.ts` |

## user

| Endereço | Métodos | Arquivo |
| --- | --- | --- |
| `/api/user/account` | DELETE | `src/app/api/user/account/route.ts` |
| `/api/user/complete-onboarding` | POST | `src/app/api/user/complete-onboarding/route.ts` |
| `/api/user/summary` | GET | `src/app/api/user/summary/route.ts` |

## users

| Endereço | Métodos | Arquivo |
| --- | --- | --- |
| `/api/users/media-kit-token` | GET, POST | `src/app/api/users/media-kit-token/route.ts` |

## v1

| Endereço | Métodos | Arquivo |
| --- | --- | --- |
| `/api/v1/creators/scatter-plot` | POST | `src/app/api/v1/creators/scatter-plot/route.ts` |
| `/api/v1/platform/charts/monthly-engagement-stacked` | GET | `src/app/api/v1/platform/charts/monthly-engagement-stacked/route.ts` |
| `/api/v1/platform/demographics` | GET | `src/app/api/v1/platform/demographics/route.ts` |
| `/api/v1/platform/highlights/performance-summary` | GET | `src/app/api/v1/platform/highlights/performance-summary/route.ts` |
| `/api/v1/platform/kpis/periodic-comparison` | GET | `src/app/api/v1/platform/kpis/periodic-comparison/route.ts` |
| `/api/v1/platform/kpis/summary` | GET | `src/app/api/v1/platform/kpis/summary/route.ts` |
| `/api/v1/platform/performance/average-engagement` | GET | `src/app/api/v1/platform/performance/average-engagement/route.ts` |
| `/api/v1/platform/performance/conversion-metrics` | GET | `src/app/api/v1/platform/performance/conversion-metrics/route.ts` |
| `/api/v1/platform/performance/engagement-distribution-format` | GET | `src/app/api/v1/platform/performance/engagement-distribution-format/route.ts` |
| `/api/v1/platform/performance/post-distribution-format` | GET | `src/app/api/v1/platform/performance/post-distribution-format/route.ts` |
| `/api/v1/platform/performance/time-distribution` | GET | `src/app/api/v1/platform/performance/time-distribution/route.ts` |
| `/api/v1/platform/performance/time-distribution/posts` | GET | `src/app/api/v1/platform/performance/time-distribution/posts/route.ts` |
| `/api/v1/platform/performance/video-metrics` | GET | `src/app/api/v1/platform/performance/video-metrics/route.ts` |
| `/api/v1/platform/trends/follower-change` | GET | `src/app/api/v1/platform/trends/follower-change/route.ts` |
| `/api/v1/platform/trends/followers` | GET | `src/app/api/v1/platform/trends/followers/route.ts` |
| `/api/v1/platform/trends/moving-average-engagement` | GET | `src/app/api/v1/platform/trends/moving-average-engagement/route.ts` |
| `/api/v1/platform/trends/reach-engagement` | GET | `src/app/api/v1/platform/trends/reach-engagement/route.ts` |
| `/api/v1/posts/[postId]/details` | GET | `src/app/api/v1/posts/[postId]/details/route.ts` |
| `/api/v1/users/[userId]/alerts/active` | GET | `src/app/api/v1/users/[userId]/alerts/active/route.ts` |
| `/api/v1/users/[userId]/charts/monthly-comparison` | GET | `src/app/api/v1/users/[userId]/charts/monthly-comparison/route.ts` |
| `/api/v1/users/[userId]/charts/monthly-engagement-stacked` | GET | `src/app/api/v1/users/[userId]/charts/monthly-engagement-stacked/route.ts` |
| `/api/v1/users/[userId]/comparison/radar-chart` | GET | `src/app/api/v1/users/[userId]/comparison/radar-chart/route.ts` |
| `/api/v1/users/[userId]/highlights/performance-summary` | GET | `src/app/api/v1/users/[userId]/highlights/performance-summary/route.ts` |
| `/api/v1/users/[userId]/kpis/periodic-comparison` | GET | `src/app/api/v1/users/[userId]/kpis/periodic-comparison/route.ts` |
| `/api/v1/users/[userId]/performance/average-engagement` | GET | `src/app/api/v1/users/[userId]/performance/average-engagement/route.ts` |
| `/api/v1/users/[userId]/performance/conversion-metrics` | GET | `src/app/api/v1/users/[userId]/performance/conversion-metrics/route.ts` |
| `/api/v1/users/[userId]/performance/engagement-distribution-format` | GET | `src/app/api/v1/users/[userId]/performance/engagement-distribution-format/route.ts` |
| `/api/v1/users/[userId]/performance/time-distribution` | GET | `src/app/api/v1/users/[userId]/performance/time-distribution/route.ts` |
| `/api/v1/users/[userId]/performance/time-distribution/posts` | GET | `src/app/api/v1/users/[userId]/performance/time-distribution/posts/route.ts` |
| `/api/v1/users/[userId]/performance/video-metrics` | GET | `src/app/api/v1/users/[userId]/performance/video-metrics/route.ts` |
| `/api/v1/users/[userId]/planning/charts-batch` | GET | `src/app/api/v1/users/[userId]/planning/charts-batch/route.ts` |
| `/api/v1/users/[userId]/planning/recommendation-feedback` | GET, POST | `src/app/api/v1/users/[userId]/planning/recommendation-feedback/route.ts` |
| `/api/v1/users/[userId]/rankings/by-category` | GET | `src/app/api/v1/users/[userId]/rankings/by-category/route.ts` |
| `/api/v1/users/[userId]/trends/follower-change` | GET | `src/app/api/v1/users/[userId]/trends/follower-change/route.ts` |
| `/api/v1/users/[userId]/trends/followers` | GET | `src/app/api/v1/users/[userId]/trends/followers/route.ts` |
| `/api/v1/users/[userId]/trends/fpc-history` | GET | `src/app/api/v1/users/[userId]/trends/fpc-history/route.ts` |
| `/api/v1/users/[userId]/trends/moving-average-engagement` | GET | `src/app/api/v1/users/[userId]/trends/moving-average-engagement/route.ts` |
| `/api/v1/users/[userId]/trends/reach-engagement` | GET | `src/app/api/v1/users/[userId]/trends/reach-engagement/route.ts` |
| `/api/v1/users/[userId]/videos/list` | GET | `src/app/api/v1/users/[userId]/videos/list/route.ts` |

## videos

| Endereço | Métodos | Arquivo |
| --- | --- | --- |
| `/api/videos` | GET | `src/app/api/videos/route.ts` |

## webhooks

| Endereço | Métodos | Arquivo |
| --- | --- | --- |
| `/api/webhooks/instagram` | GET, POST | `src/app/api/webhooks/instagram/route.ts` |
| `/api/webhooks/payment` | POST | `src/app/api/webhooks/payment/route.ts` |

## whatsapp

| Endereço | Métodos | Arquivo |
| --- | --- | --- |
| `/api/whatsapp/generateCode` | POST | `src/app/api/whatsapp/generateCode/route.ts` |
| `/api/whatsapp/incoming` | GET, POST | `src/app/api/whatsapp/incoming/route.ts` |
| `/api/whatsapp/process-response` | POST | `src/app/api/whatsapp/process-response/route.ts` |
| `/api/whatsapp/sendTips` | POST | `src/app/api/whatsapp/sendTips/route.ts` |
| `/api/whatsapp/status` | DELETE, GET | `src/app/api/whatsapp/status/route.ts` |
| `/api/whatsapp/verify` | POST | `src/app/api/whatsapp/verify/route.ts` |
| `/api/whatsapp/weeklyReport` | GET, POST | `src/app/api/whatsapp/weeklyReport/route.ts` |

## worker

| Endereço | Métodos | Arquivo |
| --- | --- | --- |
| `/api/worker/backfill-post-cover` | POST | `src/app/api/worker/backfill-post-cover/route.ts` |
| `/api/worker/classify-content` | GET, POST | `src/app/api/worker/classify-content/route.ts` |
| `/api/worker/classify-published-scene` | GET, POST | `src/app/api/worker/classify-published-scene/route.ts` |
| `/api/worker/enrich-mapa-video` | POST | `src/app/api/worker/enrich-mapa-video/route.ts` |
| `/api/worker/generate-creator-weekly-report` | POST | `src/app/api/worker/generate-creator-weekly-report/route.ts` |
| `/api/worker/process-story-webhook` | POST | `src/app/api/worker/process-story-webhook/route.ts` |
| `/api/worker/refresh-instagram-user` | POST | `src/app/api/worker/refresh-instagram-user/route.ts` |
| `/api/worker/refresh-script-evidence` | POST | `src/app/api/worker/refresh-script-evidence/route.ts` |
