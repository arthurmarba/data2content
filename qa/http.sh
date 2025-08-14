#!/usr/bin/env bash
set -euo pipefail
BASE="${1:-http://localhost:3000}"
SECRET="${INTERNAL_CRON_SECRET:-changeme}"

echo "[i] GET /api/billing/status"
curl -sS "${BASE}/api/billing/status" | jq .

echo "[i] POST /api/billing/portal"
curl -sS -X POST "${BASE}/api/billing/portal" | jq .

echo "[i] POST /api/billing/cancel"
curl -sS -X POST "${BASE}/api/billing/cancel" | jq .

echo "[i] POST /api/billing/reactivate"
curl -sS -X POST "${BASE}/api/billing/reactivate" | jq .

echo "[i] POST /api/internal/affiliate/mature (dryRun)"
curl -sS -X POST "${BASE}/api/internal/affiliate/mature" \
  -H "x-internal-secret: ${SECRET}" -H "Content-Type: application/json" \
  -d '{"dryRun":true,"limit":50,"maxItemsPerUser":20}' | jq .
