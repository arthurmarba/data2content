# Billing QA Checklist (Stripe + Node)

- [ ] 1. Active -> subscribe novamente bloqueia
  - DB com `planStatus=active|trialing` retorna 409 `SUBSCRIPTION_ACTIVE_USE_CHANGE_PLAN`
  - Stripe com sub `active|trialing` retorna 409 `SUBSCRIPTION_ACTIVE`
- [ ] 2. Cancel_at_period_end=true -> reativar funciona
  - `/api/billing/reactivate` remove `cancel_at_period_end` e mantém assinatura ativa
- [ ] 3. Canceled definitivo -> reativar falha + CTA subscribe
  - `/api/billing/reactivate` retorna 409 `NOT_REACTIVATABLE_USE_SUBSCRIBE`
  - UI mostra “Assinar novamente”, nunca “Reativar”
- [ ] 4. Incomplete -> abort -> libera novo subscribe
  - `/api/billing/abort` cancela pendências, limpa DB e permite novo checkout
- [ ] 5. Past_due/unpaid -> subscribe bloqueia e envia para pagamento
  - `/api/billing/subscribe` retorna 409 `PAYMENT_ISSUE`
  - UI guia para portal/atualizar cartão
