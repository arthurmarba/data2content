# Affiliates Observability Runbooks

## Webhook 5xx subiu
1. Abra o dashboard de Operação e identifique o tipo de evento afetado e a última release.
2. Verifique o Sentry usando `stripe_event_id` e `invoiceId` para encontrar o stack trace.
3. Confira idempotência e disponibilidade do banco.
4. **Mitigação**
   - Reprocessar manualmente eventos falhados no Stripe após o fix.
   - Se houver erro de schema, habilite fallback seguro (no-op) e faça hotfix.

## Cron sem promover
1. Confira logs `affiliate:mature` e o índice `idx_commission_pending_due`.
2. Valide `X-Job-Secret` e status do QStash.
3. Execute `/mature` com `dryRun=true` para contagem.
4. Se o banco estiver lento, reduza `batch` temporariamente.

## Transfer falhando
1. Consulte erro retornado pela Stripe: saldo, capability ou moeda incorreta.
2. Tente novo `retry` via Admin → Redemptions.
3. Se falha sistêmica, coloque `redeem` em `queue` (`status requested`) e pause execução automática, comunicando afiliados.

## Refund spike
1. Abra dashboard Stripe para confirmar origem (campanha ou bug).
2. Ajuste `alert_threshold` se sazonal.
3. Certifique-se de que `reverseCents` está abatendo saldo/dívida corretamente.
