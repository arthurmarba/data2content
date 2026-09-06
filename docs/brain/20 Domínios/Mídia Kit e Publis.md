---
tipo: domínio
---

# Mídia Kit e Publis — a monetização

## Mídia Kit

A página pública que o criador manda pra marca.

| Peça | Caminho |
| --- | --- |
| Página pública | `src/app/mediakit/[token]/` |
| Cozinha | `src/app/lib/mediakit/` |
| Rotas | `/api/mediakit/*` |
| Modelos | `MediaKitPackage`, `MediaKitPdfCache`, `MediaKitSlugAlias` |
| Blocos | `boards/MediaKitPinnedBoard.tsx`, `MediaKitOverviewBoard.tsx` |

Diferente do card "Sua Audiência", o Mídia Kit **não depende de posts classificados** — por isso ele funciona em contas onde o outro trava. Ver [[Card de audiência trava]].

O acesso é por token, com apelido de URL (`MediaKitSlugAlias`) e cache de PDF.

## Publis

O conteúdo pago. `src/app/dashboard/publis/`, `/api/publis`, modelo `PubliCalculation`, calculadora em `/api/calculator` e `src/app/lib/cpm/`.

O CPM tem ciclo de vida próprio (`docs/cpm-lifecycle.md`) e uma semente atualizável: `npm run update:cpm-seed`.

## Radar de campanhas

A central que junta oportunidades de publi de várias fontes (Squid, Playnest, MIS, BrandLovrs).

| Peça | Caminho |
| --- | --- |
| Cozinha | `src/app/lib/campaignRadar/` |
| Coletores | `campaignRadar/collectors/` |
| Match | `campaignRadar/matching.ts` |
| Modelos | `CampaignRadarOpportunity`, `CampaignRadarWeeklySelection` |
| Comandos | `npm run campaign-radar:collect`, `:audit-sources`, `:review`, `:import`, `:report` |

O match é de **três eixos**: narrativa, preço e chance real de fechar. Uma publi que combina com a narrativa mas está fora da faixa de preço não é match.

Há uma auditoria de conformidade das fontes (`:audit-sources`, e `docs/campaign-radar-source-compliance-audit.md`) — coletar de fonte errada é problema jurídico, não técnico. Rode a auditoria antes de adicionar coletor novo.

## Marcas

`src/app/lib/brands/`, `BrandNarrativeProfile`, `BrandNarrativeReport`, `npm run seed:brand-narratives` (com `--dry-run`).

## Ligações

[[Landing e conversão]] · [[Collabs]] · [[Card de audiência trava]]
