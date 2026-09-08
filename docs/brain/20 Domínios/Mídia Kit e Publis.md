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

Desde 07/09/2026, coleta e distribuição são controles separados. `collectionPolicy.ts`
permite somente descoberta interna de URLs exatas, revisadas e sem cobrança de API.
`guardedHttp.ts` barra a rede antes da consulta, verifica robots e não segue redirects.
O antigo bloqueio era só do MCP: o comando ainda acessava Linktree. Agora o bloqueio
vale também para coletores individuais e auditoria. X e Threads estão desligados.

`/admin/campaign-radar` é a caixa de entrada privada (implementação em
`dashboard/admin/campaign-radar`). `CampaignRadarCandidate` guarda captura, revisão
e histórico; `CampaignRadarRun` controla uma execução diária. Editar uma candidata
publicada a retira do catálogo até nova revisão. Recoleta com condições diferentes
também retira a publicação, atomicamente, e pede nova verificação. A comparação usa
a última observação da fonte, não o texto editado pelo administrador; assim uma
recoleta idêntica não desfaz correções. Captura original e versão anterior ficam
privadas na candidata. Título/prazo diferentes geram candidatas distintas para
comparação manual pelo link. O MCP revalida a autorização da
fonte na leitura, inclusive para registros antigos. O cron existe em código;
agendamento e publicação precisam ser confirmados separadamente.

Operação, fontes liberadas e próximos passos: `docs/radar-coleta-gratuita-operacao.md`.

## Marcas

`src/app/lib/brands/`, `BrandNarrativeProfile`, `BrandNarrativeReport`, `npm run seed:brand-narratives` (com `--dry-run`).

## Ligações

[[Landing e conversão]] · [[Collabs]] · [[Card de audiência trava]]
