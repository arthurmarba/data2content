# Catálogo de Eventos — Stage 0

| Evento | Quando dispara | Payload mínimo |
| --- | --- | --- |
| `media_kit_viewed` | Visitante abre o mídia kit público. | `creator_id`, `media_kit_id`, `referrer`, `utm_*` |
| `proposal_submitted` | Marca envia proposta via formulário do mídia kit. | `creator_id`, `proposal_id`, `budget`, `deliverables_count`, `timeline_days`, `utm_*` |
| `proposal_received` | Proposta criada com sucesso e visível ao criador. | `creator_id`, `proposal_id`, `source` |
| `campaigns_entry_clicked` | Criador usa sidebar ou alerta da home para acessar o CRM. | `creator_id`, `source`, `unread_count` |
| `campaigns_hub_viewed` | Criador chega ao CRM dedicado de campanhas. | `creator_id`, `source` |
| `campaigns_load_failed` | Lista ou briefing falha ao carregar. | `creator_id`, `source`, `stage`, `proposal_id`, `error_message` |
| `proposal_opened` | Criador abre a proposta no painel. | `creator_id`, `proposal_id`, `source`, `was_unread`, `received_to_open_hours` |
| `ai_analysis_started` | Criador aciona “Analisar com IA”. | `creator_id`, `proposal_id` |
| `ai_suggestion_generated` | IA retorna diagnóstico e sugestão. | `creator_id`, `proposal_id`, `suggestion_type`, `suggested_value` |
| `email_draft_generated` | Rascunho de e-mail criado. | `creator_id`, `proposal_id`, `subject_length`, `body_length` |
| `email_sent_via_platform` | E-mail enviado pela plataforma (North Star). | `creator_id`, `proposal_id`, `received_to_reply_hours` |
| `proposal_status_changed` | Status da proposta atualizado. | `creator_id`, `proposal_id`, `from_status`, `to_status` |
| `copy_media_kit_link` | Visitante copia o link do mídia kit. | `creator_id`, `media_kit_id`, `origin` |
| `paywall_viewed` | Paywall exibido em recurso PRO. | `creator_id`, `context`, `plan` |
| `subscription_started` | Fluxo de assinatura iniciado. | `creator_id`, `plan`, `currency`, `value` |
| `subscription_activated` | Assinatura ativada após pagamento. | `creator_id`, `plan`, `currency`, `value` |
| `subscription_canceled` | Assinatura cancelada/agendada para cancelar. | `creator_id`, `plan`, `currency`, `value` |
| `affiliate_link_clicked` | Clique em link de afiliado. | `ref_creator_id`, `new_creator_id`, `commission_base_value`, `channel` |
| `affiliate_signup_converted` | Conversão de afiliado concluída. | `ref_creator_id`, `new_creator_id`, `commission_base_value` |
| `email_delivered` | E-mail entregue pelo provedor. | `creator_id`, `proposal_id` |
| `email_bounced` | E-mail retornou com erro. | `creator_id`, `proposal_id`, `bounce_reason` |
| `email_opened` | Abertura do e-mail registrada. | `creator_id`, `proposal_id` |
| `email_link_clicked` | Clique em link do e-mail. | `creator_id`, `proposal_id`, `link_target` |

Todos os eventos incluem automaticamente: `environment`, `event_timestamp` (ISO8601) e `event_name`, adicionados pelo helper `track`.
