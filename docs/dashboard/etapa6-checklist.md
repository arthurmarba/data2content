# QA — Etapa 6 (Planejamento PRO enxuto)

Use esta lista para validar rapidamente o rollout da etapa focada em Planejamento:

## 1. Fluxo Free (gating)
- [ ] Ao abrir `/planning`, paywall modal surge com a microcopy “Planejamento é PRO…” sem carregar dados do planner.
- [ ] Sidebar grupo “Planejamento” permanece com cadeado; qualquer item (Planner/Descoberta/WhatsApp) dispara o paywall.
- [ ] Descoberta bloqueada exibe paywall ou CTA adequado, sem mostrar listas privadas.

## 2. Fluxo PRO
- [ ] Acessar `/planning/planner` renderiza cabeçalho “Seu plano da semana (PRO)” + nota de monetização.
- [ ] Botão “Gerar sugestões” abre modal e envia evento `planner_plan_generated`.
- [ ] Descoberta mostra somente consulta com texto “Use como referência…” sem botões de adicionar.
- [ ] Painel WhatsApp exibe microcopy “Diagnósticos e ideias…” e nenhuma menção a lembretes automáticos.

## 3. Telemetria
- [ ] `planning_viewed` dispara na entrada do Planner (verificar rede/console).
- [ ] `planner_plan_generated` dispara ao acionar “Gerar sugestões”.
- [ ] `paywall_viewed{context:planning}` continua sendo emitido para usuários Free.

## 4. Acessibilidade & Conteúdo
- [ ] Paywall mantém foco/ESC/tab trap.
- [ ] Planner/Descoberta/WhatsApp não introduzem botões novos (somente os já existentes).
- [ ] Sem textos prometendo lembretes ou ações inexistentes.

## 5. Rollout
- [ ] Flags `planning.group_locked` e `paywall.modal_enabled` ligados em staging e prod.
- [ ] Depois do QA manual, habilitar 100% (PRO only) e monitorar correlação Planner × `email_sent_via_platform`.
