# Etapa 2 — Dashboard Minimalista (Checklist de Aceite)

## Blocos & Microcopy
- [x] Microcopy final aplicada nos blocos principais (Checklist, Propostas, Mídia Kit, Upsell PRO) com mensagens para estados vazios e banners.
- [x] Empty states alinhados às diretrizes (“Conecte Instagram…”, “Crie seu Mídia Kit…”, “Copiar link da bio”).

## Acessibilidade & Responsividade
- [x] Layout em 1 coluna abaixo de 640px (`grid-cols-1`), mantendo 2/3 colunas em breakpoints maiores.
- [x] Botões com `aria-label`/`aria-describedby` quando necessário; atualização dos contadores com `aria-live`.
- [x] Skeletons e estados carregando consistentes entre blocos.

## Tuning & Performance
- [x] Polling restrito ao bloco de Propostas (`90s`, com refresh manual).
- [ ] Observação em staging: monitorar carga/latência da rota `scope=proposals` (baseline e ajuste fino após deploy).

## Paywall & Gating
- [x] CTAs PRO (Responder com IA, upsell) gatilham `open-subscribe-modal` no Free, sem pré-carregar dados protegidos.
- [x] Fluxo responde ao estado do plano (trial/pro) em tempo real.

## Telemetria
- [x] Evento `dashboard_cta_clicked` com `target` e `surface` padronizados (inclui `creator_id`).
- [x] Reuso de eventos existentes (`copy_media_kit_link`) em novos fluxos de cópia.
- [ ] Validar no ambiente de staging que os eventos chegam ao pipeline antes da liberação (incluir screenshots/links).

## Hardening de Flags
- [x] `nav.dashboard_minimal=ON` desliga layout legado e efeitos associados (hero, community, WhatsApp banner).
- [x] `modules.community_on_home=OFF` não reintroduz cards antigos no modo minimalista.

## QA Visual
- [ ] QA de design e mobile (prints desktop/mobile, verificação de contraste e foco) — pendente alinhamento com Design.

## Rollout Planejado
1. Habilitar em staging: `nav.dashboard_minimal=ON`, `modules.community_on_home=OFF`.
2. Capturar baseline de métricas (CTR “Abrir Propostas”, latência da rota `summary`).
3. Deploy em produção com targeting inicial de 10% (flag/segmento).
4. Monitorar por 24–48h:
   - CTR “Abrir Propostas” vs. baseline anterior.
   - Erros 4xx/5xx na rota `/api/dashboard/home/summary`.
   - Eventos `dashboard_cta_clicked`, `copy_media_kit_link`.
5. Expandir gradualmente até 100% após validação.
6. Anexar prints desktop/mobile e planilhas de métricas ao checklist final.

> **Nota:** itens marcados como pendentes dependem de verificação manual em staging/design review. Documentar evidências (prints, dashboards) antes do rollout final.
