#!/usr/bin/env bash
set -euo pipefail
APP_URL="${1:-http://localhost:3000}"
echo "[i] Iniciando stripe listen → ${APP_URL}/api/stripe/webhook"
stripe listen --forward-to "${APP_URL}/api/stripe/webhook"
