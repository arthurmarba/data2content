# Alertas recomendados — Etapa 0

## 1. Queda no funil (`proposal_submitted`)
- **Objetivo:** sinalizar queda >30% vs média móvel de 7 dias.
- **Fonte sugerida:** tabela de eventos (ex.: BigQuery/PostHog export).
- **Frequência:** diário, 09h BRT.
- **Canal:** Slack `#ops-analytics`.
- **Pseudo-query:**  
  ```sql
  WITH last_7d AS (
    SELECT COUNT(*) / 7.0 AS avg_events
    FROM analytics.events
    WHERE event_name = 'proposal_submitted'
      AND event_date BETWEEN CURRENT_DATE - 14 AND CURRENT_DATE - 8
  ),
  yesterday AS (
    SELECT COUNT(*) AS total
    FROM analytics.events
    WHERE event_name = 'proposal_submitted'
      AND event_date = CURRENT_DATE - 1
  )
  SELECT
    yesterday.total,
    last_7d.avg_events,
    yesterday.total / NULLIF(last_7d.avg_events, 0) AS ratio
  FROM yesterday, last_7d;
  ```
- **Condição:** `ratio < 0.7` → aciona alerta com o corpo:  
  `🚨 Funil em queda: X propostas ontem vs média 7d Y.`  

## 2. Ausência de e-mails enviados (`email_sent_via_platform`)
- **Objetivo:** garantir que a North Star está viva em horário comercial.
- **Janela:** rolling 2h entre 08h-20h BRT.
- **Regra:** se não houver nenhum evento `email_sent_via_platform` → aciona alerta imediatamente.
- **Escalonamento:** Slack + fallback para e-mail `analytics@data2content.co`.

## 3. Latência de ingestão
- **Objetivo:** detectar atrasos entre `event_timestamp` e hora de chegada ao data warehouse.
- **Cálculo:** `MAX(processed_at - event_timestamp)` nas últimas 2h.
- **Regra:** se `> 5 minutos` → alerta (problema de pipeline).

## Implementação
- Scripts de referência: `scripts/alerts/funnelHealth.ts` (stub).
- Sugerido agendar via cron Cloud Run/Github Actions a cada 15 minutos (latência) e hora comercial (ausência de e-mails).
- Logs devem conter `environment`, `trigger`, `metric_value` e `threshold` para facilitar auditoria.

> Lembre de versionar a configuração dos alertas (ex.: JSON/YAML em `infra/monitoring`) quando forem migrados para a plataforma oficial.
