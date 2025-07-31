# Monitoring & Observability

This module provides near real-time visibility into key KPIs and centralised error reporting.

## Dashboard Metrics
- **Active Agencies** – count of agencies with `planStatus: active`.
- **Creators** – total creators segmented by role (`user` vs `guest`).
- **Segmented MRR** – monthly recurring revenue derived from active creators and agencies.

Metrics are served by `/api/admin/monitoring/summary` and refreshed every 30s on the admin dashboard.
To add new metrics:
1. Extend the API route with the desired aggregation.
2. Update `src/app/admin/monitoring/page.tsx` to render the new data (cards, tables or charts).

## Alerts
`sendAlert` (in `src/app/lib/alerts.ts`) sends messages to configured Slack and email channels. 
It is used for:
- Access denied attempts (`getAdminSession`).
- Automatic notification for any `logger.error` call.

Configure environment variables:
- `ALERTS_SLACK_WEBHOOK_URL`
- `ALERTS_EMAIL_FROM`
- `ALERTS_EMAIL_TO`
- `SMTP_HOST` (`SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` when needed)
- `SENTRY_DSN` for error aggregation.

To add custom alerts, import and call `sendAlert` wherever needed. The logger can also be extended with additional transports.
