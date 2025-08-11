# Affiliate Program

This document describes the affiliate program implementation within the application.

## Commission Flow

1. **Trigger**: `invoice.payment_succeeded` webhook when the first subscription invoice is paid.
2. **Guards**:
   - Only invoices with `billing_reason=subscription_create` and `total > 0` generate commissions.
   - A commission is paid only once per referred user. Existing `commissionLog` entries with `status: paid` for the same `referredUserId` block duplicates.
3. **Transfer**:
   - Uses `stripe.transfers.create` with idempotency key `commission_<invoiceId>_<affiliateId>`.
   - Metadata records `invoiceId`, `referredUserId`, `affiliateUserId` and `affiliateCode`.
   - On transfer failure, the amount is credited to `affiliateBalance` for manual payout (`status: failed`).
4. **Cleanup**: `user.affiliateUsed` is cleared after the first charge.
5. **Logging**: Structured logs store `event.id`, `invoice.id`, `customer`, `amountCents`, `currency`, `status` and `transferId`.

## Stripe Connect Onboarding

- Endpoint `POST /api/affiliate/connect/create-link` creates a Connect account with `capabilities.transfers.requested=true` and `metadata.userId`.
- Endpoint `GET /api/affiliate/connect/status` maps the account status to:
  - `verified` – `details_submitted && charges_enabled && payouts_enabled`
  - `restricted` – `requirements.disabled_reason`
  - `disabled` – `disabled_reason`
  - otherwise `pending`
- Retrieved status is persisted in `paymentInfo.stripeAccountStatus`.

## Subscription and Coupon

- Endpoint `POST /api/billing/subscribe` accepts `plan`, `currency` and optional `affiliateCode`.
- When `affiliateCode` is present a coupon defined by `STRIPE_COUPON_10OFF_ONCE_BRL` or `STRIPE_COUPON_10OFF_ONCE_USD` (based on the currency) is applied via `discounts`.
- Auto‑usage is blocked when `affUser._id === user._id`.
- If an existing `stripeSubscriptionId` is `canceled` or `incomplete_expired`, a new subscription is created; otherwise the existing one is updated with `payment_behavior: default_incomplete`, `proration_behavior: create_prorations`, `billing_cycle_anchor: now` and `expand: latest_invoice.payment_intent`.
- Price IDs are resolved for BRL/USD ensuring plan and currency consistency.

## Front‑End Tracking

- Affiliate links include `?ref=` or `?aff=`; the code stores the value in `aff_code` cookie (TTL 30 days).
- During subscription the cookie value is sent as `affiliateCode` in the request body.
- Checkout UI displays “Cupom de 10% aplicado na primeira cobrança” when an affiliate code is present.

## Affiliate Dashboard

Route: `/dashboard/affiliate`

Features:

- **Connect to Stripe** button calling `POST /api/affiliate/connect/create-link` and redirecting to onboarding.
- **Status badge** showing `pending`, `restricted`, `verified` or `disabled` based on `GET /api/affiliate/connect/status`.
- **Commission log** table displaying date, amount, currency, status, `invoiceId` and `transferId`.
- Displays `affiliateBalance` and manual payout instructions when the account is not verified.
- Provides copyable affiliate link `${APP_URL}/?ref=${user.affiliateCode}`.

## Admin – Reprocess Commissions

Route: `/admin/affiliates/commissions`

- List and filter commissions with `status` in `[failed, fallback]`.
- Action **Reprocess** triggers `POST /api/admin/affiliate/commissions/:id/retry`.
- If the affiliate account is verified a new `transfer` is attempted; on success the entry is marked `paid` with `transferId`.
- Access restricted to users with `role=admin` via NextAuth.

## Monetary Fields

- Monetary amounts are stored in cents where possible. `affiliateBalanceCents` may be used to avoid precision issues; UI divides by 100 for display.
- `commissionLog` entries store `amountCents` and `currency`.

## Observability

- Logs (info/error) include `event.id`, `customer`, `invoice.id`, `transferId` and `status`.
- Alerts should be configured in Sentry or logging platform when commission transfers fail or accounts become `restricted/disabled`.
- Runbook steps:
  1. Check logs for commission events.
  2. Use the admin panel to reprocess or pay manual balances.
  3. For manual payouts, transfer the recorded `affiliateBalance` and mark entries as paid.

## QA Scenarios

- BRL and USD subscriptions with affiliate codes apply 10% coupon and pay commission (transfer or fallback).
- Webhook replay with the same `event.id` does not generate duplicate commissions.
- A user referring another receives commission only once even after cancellations and re‑subscriptions.
- Transfer failure credits `affiliateBalance` instead of creating a transfer.
- Using one’s own affiliate code is blocked.
- Subscriptions in `canceled` state create a new subscription; active ones update the existing item.
- 3‑D Secure flows return `clientSecret` for front‑end confirmation.
- Affiliate dashboard reflects Stripe Connect status after onboarding.

## Configuration

Environment variables:

```bash
STRIPE_PRICE_MONTHLY_BRL
STRIPE_PRICE_ANNUAL_BRL
STRIPE_PRICE_MONTHLY_USD
STRIPE_PRICE_ANNUAL_USD
STRIPE_COUPON_10OFF_ONCE_BRL
STRIPE_COUPON_10OFF_ONCE_USD
STRIPE_CONNECT_MODE=express|standard
AFFILIATE_COMMISSION_PERCENT=10
NEXT_PUBLIC_APP_URL
NEXTAUTH_URL
```

Configure the Stripe webhook to point to `/api/stripe/webhook` for both test and live environments.

