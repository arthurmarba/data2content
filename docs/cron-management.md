# Cron Management

This project provisions QStash schedules via code to keep production and staging in sync.

## Environment
- `QSTASH_TOKEN`: Upstash API token with schedule permissions.
- `ADMIN_TOKEN`: Token validated by the admin routes (also injected into `Upstash-Forward-Authorization`).

Ensure both variables are present before running any commands. Local execution can load them from `.env.local`, CI from deployment secrets.

## Provisioning
Run:

```bash
npm run schedule:crons
```

The script (`src/scripts/scheduleCrons.ts`) creates or replaces the CPM-related schedules:
- `cpm-weekly-snapshot`
- `cpm-daily-monitor`
- `cpm-monthly-update`
- `cpm-cleanup`

Each request is sent with `Content-Type: application/json` and forwards the admin bearer token so the API can authenticate the call.

Expected console output shows one `Creating QStash schedule` line per cron followed by `✅ All CPM-related crons scheduled successfully.` Errors bubble up and set a non-zero exit code.

## Verification
- Check the Upstash QStash dashboard: the four schedules should appear with the designated cron expressions and destinations under `https://data2content.ai/api/admin/...`.
- Monitor application logs or Sentry for the messages `[CPM_HISTORY_SNAPSHOT]`, `[CPM_MONITOR]`, `[CPM_SEED_UPDATE]`, and `[CPM_CLEANUP]` when schedules run.

Re-run the script after deployments, migrations, or when rotating tokens to keep schedules up to date.
