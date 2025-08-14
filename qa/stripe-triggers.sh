#!/usr/bin/env bash
set -euo pipefail
echo "[i] Disparando eventos básicos…"
stripe trigger invoice.payment_succeeded
stripe trigger invoice.payment_failed
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
stripe trigger charge.refunded
stripe trigger invoice.voided
echo "[i] Concluído."
