# Catálogo de Eventos — Stage 0

| Evento | Quando dispara | Payload mínimo |
| --- | --- | --- |
| `media_kit_viewed` | Visitante abre o mídia kit público. | `creator_id`, `media_kit_id`, `referrer`, `utm_*` |
| `proposal_submitted` | Marca envia proposta via formulário do mídia kit. | `creator_id`, `proposal_id`, `budget`, `deliverables_count`, `timeline_days`, `utm_*` |
| `proposal_received` | Proposta criada com sucesso e visível ao criador. | `creator_id`, `proposal_id`, `source` |
| `proposal_opened` | Criador abre a proposta no painel. | `creator_id`, `proposal_id` |
| `ai_analysis_started` | Criador aciona “Analisar com IA”. | `creator_id`, `proposal_id` |
| `ai_suggestion_generated` | IA retorna diagnóstico e sugestão. | `creator_id`, `proposal_id`, `suggestion_type`, `suggested_value` |
| `email_draft_generated` | Rascunho de e-mail criado. | `creator_id`, `proposal_id`, `subject_length`, `body_length` |
| `email_sent_via_platform` | E-mail enviado pela plataforma (North Star). | `creator_id`, `proposal_id` |
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
