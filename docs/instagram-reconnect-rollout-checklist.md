# Instagram Reconnect V2 Rollout Checklist

## Feature flag
- Env var: `IG_RECONNECT_V2_ENABLED`
- Default: `false`
- Scope: server-side OAuth/reconnect behavior in NextAuth callback

## Before enabling
- Confirm `CRON_SECRET` is configured for `/api/cron/refresh-instagram-data`.
- Confirm `QSTASH_*` signing keys are configured in production.
- Confirm dashboard logs include:
  - `ig_reconnect_started`
  - `ig_oauth_callback_ok`
  - `ig_account_connected`
  - `ig_reconnect_failed`

## Rollout plan
1. Set `IG_RECONNECT_V2_ENABLED=false` on production deploy.
2. Enable for 10% (if deployment platform supports gradual env rollout) or enable in a low-traffic window.
3. Monitor reconnect failure ratio per hour (`ig_reconnect_failed / ig_reconnect_started`).
4. If stable for 24h, scale to 50%.
5. If stable for 72h, scale to 100%.

## Rollback
- Set `IG_RECONNECT_V2_ENABLED=false`.
- Redeploy/restart service.
- Verify new reconnect attempts return to legacy behavior and no 5xx spike in:
  - `/api/auth/[...nextauth]`
  - `/api/instagram/connect-selected-account`

