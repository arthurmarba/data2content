# Dashboard Home — Regras & Fallbacks (MVP)

Este diretório implementa a nova Home do dashboard. Cada card tem regras claras de dados e estados vazios para facilitar futuras integrações.

## Cards da Release 1

### 1. `next_post`
- **Dados esperados**: slot (dia/hora), 1–3 ganchos, lift vs. P50, status de conexão do Instagram.
- **Fallback**: se `isInstagramConnected === false`, exibe CTA “Conectar Instagram” com copy “Conecte o Instagram para gerar seu primeiro planner personalizado”.
- **Principais ações**: `generate_script`, `show_variations`, `test_idea`, `connect_instagram`.

### 2. `consistency`
- **Dados esperados**: streak de dias, meta de posts na semana, posts realizados, alerta de canibalização.
- **Fallback**: sem dados → mensagem “Defina uma meta simples: 3–5 posts nesta semana” + CTA para planejar.
- **Ações**: `plan_week`, `view_hot_slots`.

### 3. `mentorship`
- **Dados esperados**: data/horário da próxima mentoria, tema, status do usuário na comunidade.
- **Fallback**: se `isMember === false`, card exibe CTA “Entrar na comunidade” com copy sobre votação de temas.
- **Ações**: `join_community`, `add_to_calendar`, `whatsapp_reminder`.

### 4. `media_kit`
- **Dados esperados**: link compartilhável, highlights (top post, ER 30d, cidades), data da última atualização.
- **Fallback**: se `hasMediaKit === false`, CTA “Criar media kit agora”.
- **Ações**: `copy_link`, `refresh_highlights`, `open_brand_view`, `create_media_kit`.

### 5. `community_metrics`
- **Dados esperados**: métricas agregadas (label, valor, delta) para 7d/30d/90d.
- **Fallback**: sem métricas → mensagem informando insuficiência de dados.
- **Ações**: `view_insights` + eventos `home_card_period_change` para troca de janela.

## Telemetria
- Hook `useHomeTelemetry` expõe `trackCardAction` e `trackCardPeriodChange`.
- Eventos seguem o formato `home_card_*` (p. ex. `home_card_click`, `home_card_period_change`) com `card_id` padronizado.

## Próximos Passos
- Substituir dados mockados em `HomeClientPage` por chamadas reais (planner, métricas de comunidade, billing etc.).
- Implementar camada de carregamento (`loading`) e tratamento de erros usando os props já previstos em `CardShell`.
- Encadear ações dos CTAs às rotas/modais correspondentes (planner, WhatsApp, media kit).

