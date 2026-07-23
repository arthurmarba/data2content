# Roteiro de QA — Etapa 0 (Funil Propostas)

| Passo | Ação | Eventos esperados | Evidência |
| --- | --- | --- | --- |
| 1 | Acessar `/mediakit/[slug]` como visitante | `media_kit_viewed` (com `creator_id`, `media_kit_id`, `utm_*`) | Console/Debugger |
| 2 | Copiar link do kit | `copy_media_kit_link` (`origin` = `clipboard` ou `web_share`) | Console/Debugger |
| 3 | Enviar proposta (preencher orçamento + entregáveis) | `proposal_submitted`, `proposal_received` | Log server + analytics UI |
| 4 | Logar como criador, entrar por sidebar/home/e-mail e abrir proposta | `campaigns_entry_clicked`, `campaigns_hub_viewed`, `proposal_opened` | DevTools Network |
| 5 | Rodar análise com IA | `ai_analysis_started`, `ai_suggestion_generated`, `email_draft_generated` | Console + payload verificado |
| 6 | Ajustar status manualmente (ex.: aceitar) | `proposal_status_changed` (`from_status`, `to_status`) | Console/Debugger |
| 7 | Enviar resposta pelo e-mail interno | `email_sent_via_platform` (+ status change, se aplicável) | Console/Debugger |
| 8 | Visualizar paywall (WhatsApp / Planner) sem PRO | `paywall_viewed` (context correspondente) | Console/Debugger |
| 9 | Iniciar trial / assinatura via PlanCard | `subscription_started` | Network + backend registro |
| 10 | Finalizar checkout e cair na página de sucesso | `subscription_activated` | Console/Debugger |
| 11 | Cancelar renovação na área de billing | `subscription_canceled` | Console/Debugger |

> 👉 Para cada passo, salvar screenshot ou gravação curta do evento no provedor (PostHog, GA4, etc.) + payload completo do `console.debug` (dev). Armazenar no drive compartilhado em `QA/etapa-0`.

## Recuperação de falhas

1. Simular falha em `GET /api/proposals`: o CRM deve informar que as campanhas estão indisponíveis e oferecer **Tentar novamente**, sem mostrar o estado vazio.
2. Com uma lista já carregada, simular falha de atualização: os dados anteriores devem permanecer visíveis com aviso discreto.
3. Simular falha em `GET /api/proposals/[id]`: o detalhe deve oferecer **Tentar novamente** e, no mobile, **Voltar às campanhas**.
4. Confirmar `campaigns_load_failed` com `stage=list` ou `stage=detail`.
