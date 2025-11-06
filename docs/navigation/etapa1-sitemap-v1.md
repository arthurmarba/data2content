# Sitemap v1 — Navegação Centralizada em Campanhas

## Hierarquia Canônica

| Ordem | Seção                | Label de menu             | Rota canônica | Sub-rotas / Âncoras                                 | Público          | Notas principais |
| ----- | -------------------- | ------------------------- | ------------- | -------------------------------------------------- | ---------------- | ---------------- |
| 1     | Dashboard            | `Dashboard`               | `/dashboard`  | —                                                  | Free / PRO       | Página inicial após login. |
| 2     | Campanhas            | `Campanhas`               | `/campaigns`  | `?tab=inbox`, `?tab=analysis`, `?tab=sent`         | Free / PRO       | Inbox é default; Analysis exige PRO. |
| 3     | Mídia Kit            | `Mídia Kit`               | `/media-kit`  | `/m/{token}` (público, existente)                  | Free / PRO       | `/m/{token}` permanece sem alterações. |
| 4     | Planejamento (PRO)   | `Planejamento (PRO)`      | `/planning`   | `/planning/discover`, `/planning/planner`, `/planning/whatsapp` | PRO (paywall) | Grupo colapsável com cadeado para Free. |
| 5     | Assinatura PRO       | `PRO`                     | `/pro`        | —                                                  | Free / PRO       | CTA constante para upgrade/gerir plano. |
| 6     | Indique e Ganhe      | `Indique e Ganhe`         | `/affiliates` | —                                                  | Free / PRO       | Mantém fluxo atual de afiliados. |
| 7     | Perfil & Ajuda       | `Perfil & Ajuda`          | `/settings`   | `/settings/profile`, `/settings/billing`, `/help`  | Free / PRO       | `/help` servirá como FAQ/contato. |

## Redirects (301) Planejados

| Rota legada                         | Destino canônico | Tipo     | Preserva query/UTM | Observações |
| ---------------------------------- | ---------------- | -------- | ------------------ | ----------- |
| `/dashboard/home`                  | `/dashboard`     | 301      | Sim                | Atual `MAIN_DASHBOARD_ROUTE`. |
| `/dashboard/proposals`             | `/campaigns`     | 301      | Sim                | Aplica `?tab=inbox` quando não houver query. |
| `/dashboard/proposals?view=sent`   | `/campaigns?tab=sent` | 301 | Sim                | Conversão de parâmetros específicos. |
| `/dashboard/proposals?view=ai`     | `/campaigns?tab=analysis` | 301 | Sim | Mantém upsell PRO. |
| `/dashboard/discover`              | `/planning/discover` | 301 | Sim | Gating via paywall quando Free. |
| `/dashboard/calculator`            | `/planning/planner` | 301 | Sim | Mantém comportamento do planner/IA. |
| `/dashboard/planning`              | `/planning`      | 301      | Sim                | Entrypoint do grupo colapsado. |
| `/dashboard/media-kit`             | `/media-kit`     | 301      | Sim                | Mantém comportamento atual. |
| `/dashboard/afiliados`             | `/affiliates`    | 301      | Sim                | Nenhuma mudança de lógica. |
| `/dashboard/settings`              | `/settings`      | 301      | Sim                | Subrotas continuam acessíveis via hash/tab. |
| `/dashboard/billing`               | `/settings/billing` | 301  | Sim                | Ajuste do CTA Gerir Assinatura. |
| `/dashboard/chat`                  | `/campaigns?tab=analysis` | 302 (manter) | Sim | Chat vira parte do fluxo Campanhas/Analysis. |
| `/dashboard/home?modules=community` | `/dashboard`    | 301      | Sim                | Flag `modules.community_on_home` cobre fallback. |

> **Observação:** rotas administrativas (`/app/admin/**`, `/app/agency/**`) permanecem fora do escopo desta etapa.
