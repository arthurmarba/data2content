# Lançamento Stripe 100% Multimoeda

Este documento consolida a especificação, checklist e critérios de aceite para finalizar a migração completa para Stripe com suporte multimoeda, comissões de afiliados por moeda, saque manual e Connect.

## Visão Geral
- **Stripe-only**: rotas de assinatura e webhooks Stripe ativas.
- **Multimoeda**: `affiliateBalances` (`Map<moeda, cents>`) já adotado; migração criada.
- **Retry admin**: reprocessa transferência via Connect; faz fallback quando moeda ≠ da conta destino.
- **Redeem**: saque por moeda, com mínimo e zerando saldo em `affiliateBalances`.
- **Rate limit + sessão**: endpoints com `checkRateLimit` + `getServerSession`.

## EPIC 1 — Webhook Stripe único e robusto
**Objetivo**: Consolidar `/api/stripe/webhook` para processar `invoice.payment_succeeded|failed`, `customer.subscription.*` com idempotência e multimoeda.

**Tarefas**
- Manter apenas uma implementação do webhook (versão com `logger`, `dynamic='force-dynamic'` e `req.text()`).
- Ao alterar `affiliateBalances (Map)`, chamar `user.markModified('affiliateBalances')` antes de `save()`.
- Validar motivos da invoice: tratar `subscription_create` e `subscription_cycle`.
- Confirmar idempotência com `user.lastProcessedEventId`.
- Logar `event.id`, `invoice.id`, `customerId`, `currency`, `invoice.total`.

**Critérios de Aceite**
- Simulação Stripe CLI (USD e BRL) credita comissão correta:
  - Conta destino mesma moeda → cria `transfer`, `status='paid'`, não credita fallback.
  - Conta destino outra moeda → `status='fallback'` e soma em `affiliateBalances[cur]` (cents).
- Nenhum 400/500 indevido; assinatura do webhook validada.

## EPIC 2 — Subscribe multimoeda
**Objetivo**: Assinatura via `/api/billing/subscribe` com plano/moeda corretos e validação de cupom por moeda.

**Tarefas**
- Garantir `getPriceId(plan, currency)` com todas envs definidas (`STRIPE_PRICE_MONTHLY_BRL`, `STRIPE_PRICE_ANNUAL_BRL`, `STRIPE_PRICE_MONTHLY_USD`, `STRIPE_PRICE_ANNUAL_USD`).
- Se houver cupom (`STRIPE_COUPON_10OFF_ONCE_BRL` ou `STRIPE_COUPON_10OFF_ONCE_USD`), aplicar apenas se compatível com a moeda configurada.
- Usuário com `stripeSubscriptionId` ativo → ignorar `affiliateCode` e atualizar price.

**Critérios de Aceite**
- Assinatura criada/atualizada para USD e BRL conforme o body.
- No Stripe Dashboard, o item reflete o price ID da moeda correta.

## EPIC 3 — Stripe Connect (afiliado)
**Objetivo**: Concluir fluxo Connect com visibilidade de moeda de destino.

**Tarefas**
- `status` retorna também `destCurrency` (`default_currency` da Connect account).
- Front-end exibe aviso quando `destCurrency ≠ moeda do saldo` (pagamentos cairão em fallback).

**Critérios de Aceite**
- `GET /api/affiliate/connect/status` → `{ stripeAccountId, stripeAccountStatus, destCurrency, affiliatePayoutMode, needsOnboarding }`.

## EPIC 4 — Retry admin (reprocessamento)
**Objetivo**: Finalizar reprocessamento por invoice com multimoeda e saldo.

**Tarefas**
- Se `destCurrency !== commission.currency` → manter `status='fallback'` (sem mexer no saldo se a comissão já está no Map).
- Se `destCurrency === commission.currency` → criar `transfer`, setar `status='paid'`; subtrair de `affiliateBalances[cur]` (cents) e `markModified`.
- Logar tentativa e resultado (`transferId`/`fallback`).

**Critérios de Aceite**
- Admin reprocessa com feedback claro: `{success:true, transferId}` ou `{success:true, status:'fallback'}`.
- Saldos por moeda ajustados corretamente.

## EPIC 5 — Redeem por moeda (manual)
**Objetivo**: Fechar saque manual por moeda, com mínimo, registro e zeragem do saldo.

**Tarefas**
- `POST` já recebe `currency` e zera `affiliateBalances[cur]` (`markModified`).
- Manter mínimo por moeda (`50 * 100`).
- `PATCH` (admin) atualiza `status` e `notes`.

**Critérios de Aceite**
- Cria `Redemption` em BRL/USD quando saldo ≥ mínimo; saldo zera apenas na moeda solicitada.
- `GET` lista, `PATCH` atualiza corretamente.

## EPIC 6 — Sessão/Typing + Endpoint do afiliado
**Objetivo**: Sessão expor saldos por moeda (em cents) e endpoint de afiliado consistente.

**Tarefas**
- Callback `session`: converter `Map → objeto plain` (`Object.fromEntries(dbUser.affiliateBalances || [])`).
- Documentar: `affiliateBalances` sempre em cents (UI formata).
- `GET /api/affiliate` já retorna `{ affiliate_code, affiliate_balances }` — manter.

**Critérios de Aceite**
- `useSession()` traz `session.user.affiliateBalances` como objeto `{ brl: 12345, usd: 6789 }` (cents).
- Endpoint `/api/affiliate` idêntico ao da sessão.

## EPIC 7 — Migração & Modelo User
**Objetivo**: Garantir que todos os usuários tenham o saldo legado migrado para o Map por moeda.

**Tarefas**
- Script de migração: seta `affiliateBalances` com somatório por moeda (cents).
- `markModified('affiliateBalances')` + zera legados `affiliateBalance/affiliateBalanceCents`.
- Manter campos legados apenas por compat (não utilizados).

**Critérios de Aceite**
- Pós-migração: `affiliateBalances` populado; legados = 0.
- Sem erros de persistência `Map` em produção.

## EPIC 8 — Observabilidade e rate limit
**Objetivo**: Logs consistentes e proteção básica anti-abuso.

**Tarefas**
- Padronizar logs em: subscribe, webhook, retry, redeem (evento, ids, currency, cents).
- Revisar chaves do `checkRateLimit` (prefixos coerentes, TTL adequados).

**Critérios de Aceite**
- Logs úteis para reconstruir timeline de pagamento/transfer.
- Nenhum endpoint crítico sem rate limit.

## EPIC 9 — Testes automatizados
**Objetivo**: Cobertura mínima dos fluxos críticos multimoeda.

**Tarefas**
- Unit: `normCur` e manipulação de `Map` (já tem; manter).
- Webhook `invoice.payment_succeeded`:
  - Mesma moeda → cria transfer, `status='paid'`, não credita fallback.
  - Moedas diferentes → `status='fallback'` e soma em `affiliateBalances[cur]` (cents).
- Retry admin:
  - Moeda ≠ → mantém fallback, sem alterar saldo.
  - Moeda = → paid, saldo decrementado (cents).
- Redeem:
  - Sem saldo → 400.
  - Com saldo → cria `Redemption` e zera `affiliateBalances[cur]`.
- Connect/status:
  - Mock `stripe.accounts.retrieve` retornando `default_currency`; API responde `destCurrency`.

**Critérios de Aceite**
- CI verde com os cenários BRL e USD.

## EPIC 10 — Operação & Go-Live
**Objetivo**: Runbook Stripe, variáveis e checklist de lançamento.

**Tarefas**
- Variáveis obrigatórias:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `STRIPE_CONNECT_MODE=express`
  - `STRIPE_PRICE_MONTHLY_BRL`, `STRIPE_PRICE_ANNUAL_BRL`
  - `STRIPE_PRICE_MONTHLY_USD`, `STRIPE_PRICE_ANNUAL_USD`
  - (opcional) `STRIPE_COUPON_10OFF_ONCE_BRL`, `STRIPE_COUPON_10OFF_ONCE_USD`
- Stripe CLI: script de teste (local ou staging) para:
  - Criar/atualizar assinatura BRL e USD
  - Disparar `invoice.payment_succeeded`
  - Validar saldo do afiliado (`fallback` e `paid`)
- Checklist Go-Live:
  - Webhook apontado para `/api/stripe/webhook`
  - Preços por moeda ativos no Dashboard
  - Connect Express ativo e testado
  - Migração de saldos executada
  - Testes passando

**Critérios de Aceite**
- Time consegue testar ponta-a-ponta apenas com Stripe (sem serviços externos).
- Lançamento sem pendências conhecidas.

## Riscos & Mitigações
- Moeda inconsistente entre invoice e Connect: tratar com fallback por moeda (`Map`).
- Corpo do webhook: usar `req.text()` e não JSON parsing.
- Persistência de `Map`: sempre `markModified('affiliateBalances')` após set.
