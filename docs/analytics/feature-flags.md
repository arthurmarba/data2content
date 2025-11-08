# Matriz de Feature Flags — Etapa 0

| Flag | Descrição | Dev | Staging | Prod | Owner | Observações |
| --- | --- | --- | --- | --- | --- | --- |
| `nav.dashboard_minimal` | Limita a sidebar aos itens essenciais (Home, Propostas, Planejamento, Assinatura). | off | off | off | Produto | Ideal para experimentos de onboarding simplificado. |
| `nav.campaigns_focus` | Destaca “Propostas Recebidas” logo abaixo de “Início”. | off | off | off | Produto | Usar junto com campanhas de ativação de propostas. |
| `planning.group_locked` | Bloqueia o bloco “Planejar com IA” para contas sem PRO, exibindo CTA de upgrade. | off | on | on | Growth | Quando ativo, qualquer CTA de planejamento abre o paywall/modal configurado. |
| `modules.community_on_home` | Mostra o cartão da comunidade na Home (desliga para reduzir ruído). | on | on | on | Community | Pode ser desligado durante ciclos focados em campanhas. |
| `paywall.modal_enabled` | Exibe o modal global `BillingSubscribeModal` ao disparar `open-subscribe-modal`. | on | on | on | Growth | Quando off, redireciona usuários direto para `/dashboard/billing`. |
| `home.tutorial_minimal` | Mostra o tutorial + grid simplificado na home do dashboard. | on | on | on | Produto | Novo padrão; desligue manualmente apenas para rollback. |

> Os estados “Dev/Staging/Prod” representam os valores padrão definidos pelo backend (`DEFAULT_FEATURE_FLAGS`). Atualizações por ambiente são feitas via `PATCH /api/feature-flags` e são aplicadas em tempo real pelo provider do app (`FeatureFlagProvider`).
