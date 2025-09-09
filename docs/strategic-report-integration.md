# Strategic Report no Media Kit

Este documento resume a integração do Relatório Estratégico dentro do Media Kit, focando em layout, reuso de componentes do admin e visibilidade das informações de execução.

## Seções adicionadas

- Destaques de Performance (user): `src/app/mediakit/[token]/components/UserPerformanceHighlights.tsx`
- Análise de Performance por Horário (user): `src/app/mediakit/[token]/components/UserTimePerformanceHeatmap.tsx`
- Rankings por Categorias (user): reuso de `CategoryRankingsSection` (admin)
- Badges de posição do usuário: `src/app/mediakit/[token]/components/UserCategoryPositionBadges.tsx`
- Container: `src/app/mediakit/[token]/StrategicReportSection.tsx`

Ordem visual: 1) Destaques, 2) Horário, 3) Rankings. Posições do usuário aparecem acima dos rankings.

## API

- Destaques (user): `GET /api/v1/users/:userId/highlights/performance-summary`
- Horário (user): `GET /api/v1/users/:userId/performance/time-distribution`
- Rankings por categorias (global/user): `GET /api/admin/dashboard/rankings/categories?category=...&metric=...&startDate=...&endDate=...&userId=...`
- Rank por categoria do criador: `GET /api/v1/users/:userId/rankings/by-category?category=...&value=...&metric=avg_total_interactions&timePeriod=last_90_days`

## “Como executar”

As oportunidades comerciais foram expostas inline (sem botões/colapsáveis) com seções padrão: Contexto, Passos práticos, KPIs e Riscos/Observações nas UIs:

- Dashboard: `src/app/dashboard/reports/strategic/StrategicReportClient.tsx`
- Media Kit (interno): `src/app/dashboard/media-kit/StrategicReportInline.tsx`

## Responsividade e UX

- Grid 12 col (lg) e 6 col (md) concebido via utilitários Tailwind nas seções.
- Skeletons leves nos destaques e heatmap.
- Sem nested cards: cada bloco é renderizado com seu próprio card padrão do admin para manter consistência.

## Observações

- Se desejar restringir a exibição de oportunidades comerciais no Media Kit público, use uma checagem de sessão no container que renderiza a seção e/ou um feature flag via `process.env`.

