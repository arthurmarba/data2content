# Affiliate Program

This document describes the affiliate program implementation within the application.

## Commission Flow

1. **Trigger**: `invoice.payment_succeeded` webhook when the first subscription invoice is paid.
2. **Guards**:
   - Only invoices with `amount_paid > 0` generate commissions.
   - A commission is created only once per subscription via `AffiliateSubscriptionIndex`.
   - Replayed webhook events and repeated invoices are blocked by `AffiliateInvoiceIndex`.
3. **Amount**:
   - The referred user receives `10%` discount only on the first invoice, via a Stripe coupon configured as `percent_off=10` and `duration=once`.
   - The affiliate receives `50%` commission over the amount effectively paid on that first invoice.
   - The applied rate is persisted in `commissionLog.commissionRateBps` so refunds and adjustments keep historical correctness.
4. **Settlement**:
   - The webhook creates the commission as `pending`.
   - After the hold window, the maturation job promotes it to `available` and credits `affiliateBalances`.
   - Redeem/retry flows later mark it as `paid`.
5. **Logging**: Structured logs store `event.id`, `invoice.id`, `customer`, `amountCents`, `currency`, `status` and transfer metadata.

## Stripe Connect Onboarding

- Endpoint `POST /api/affiliate/connect/create` ensures the user has a Connect account (`capabilities.transfers.requested=true`, `metadata.userId`).
- Endpoint `POST /api/affiliate/connect/link` returns an onboarding or login link depending on account status.
- Endpoint `GET /api/affiliate/connect/status` maps the account status to:
  - `verified` – `details_submitted && charges_enabled && payouts_enabled`
  - `restricted` – `requirements.disabled_reason`
  - `disabled` – `disabled_reason`
  - otherwise `pending`
- Retrieved status is persisted in `paymentInfo.stripeAccountStatus`.

## Subscription and Coupon

- Endpoint `POST /api/billing/subscribe` accepts `plan`, `currency` and optional `affiliateCode`.
- When `affiliateCode` is present a coupon defined by `STRIPE_COUPON_AFFILIATE10_ONCE_BRL` or `STRIPE_COUPON_AFFILIATE10_ONCE_USD` (based on the currency) is applied via `discounts`.
- The backend validates the Stripe coupon before using it. It must be exactly `10%` and `once`.
- Auto‑usage is blocked when `affUser._id === user._id`.
- If an existing `stripeSubscriptionId` is `canceled` or `incomplete_expired`, a new subscription is created; otherwise the existing one is updated with `payment_behavior: default_incomplete`, `proration_behavior: create_prorations`, `billing_cycle_anchor: now` and `expand: latest_invoice.payment_intent`.
- Price IDs are resolved for BRL/USD ensuring plan and currency consistency.

## Front‑End Tracking

- Affiliate links include `?ref=` or `?aff=`; the code stores the value in `d2c_ref` cookie (TTL 90 days).
- During subscription the cookie value is sent as `affiliateCode` in the request body.
- Checkout UI displays the affiliate discount only for the first invoice.

## Affiliate Dashboard

Route: `/dashboard/affiliate`

Features:

- **Connect to Stripe** button calling `POST /api/affiliate/connect/create` then `POST /api/affiliate/connect/link` and redirecting to onboarding.
- **Status badge** showing `pending`, `restricted`, `verified` or `disabled` based on `GET /api/affiliate/connect/status`.
- **Commission log** table displaying date, amount, currency, status, `invoiceId` and `transactionId`.
- Displays `affiliateBalance` and manual payout instructions when the account is not verified.
- Provides copyable affiliate link `${APP_URL}/?ref=${user.affiliateCode}`.

## Admin – Reprocess Commissions

Route: `/admin/affiliates/commissions`

- List and filter commissions with `status` in `[failed, fallback]`.
- Action **Reprocess** triggers `POST /api/admin/affiliate/commissions/:id/retry`.
- If the affiliate account is verified a new `transfer` is attempted; on success the entry is marked `paid` with `transactionId`.
- Access restricted to users with `role=admin` via NextAuth.

## Monetary Fields

- Monetary amounts are stored in cents.
- `commissionLog` entries store `amountCents`, `currency`, `commissionRateBps`, lifecycle dates (`availableAt`, `maturedAt`, `paidAt`, `reversedAt`) and payout references (`redeemId`, `transferId`) when applicable.

## Observability

- Logs (info/error) include `event.id`, `customer`, `invoice.id`, `transactionId` and `status`.
- Alerts should be configured in Sentry or logging platform when commission transfers fail or accounts become `restricted/disabled`.
- Runbook steps:
  1. Check logs for commission events.
  2. Use the admin panel to reprocess or pay manual balances.
  3. For manual payouts, transfer the recorded `affiliateBalance` and mark entries as paid.

## QA Scenarios

- BRL and USD subscriptions with affiliate codes apply `10%` only on the first invoice.
- The first paid invoice creates exactly one `50%` commission entry.
- Webhook replay with the same `event.id` does not generate duplicate commissions.
- A second invoice for the same subscription does not create a new commission.
- Refund partial/total adjusts the commission using the stored `commissionRateBps`.
- Transfer failure credits `affiliateBalances` instead of losing the commission.
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
STRIPE_COUPON_AFFILIATE10_ONCE_BRL
STRIPE_COUPON_AFFILIATE10_ONCE_USD
STRIPE_CONNECT_MODE=express|standard
COMMISSION_RATE=0.5
NEXT_PUBLIC_APP_URL
NEXTAUTH_URL
```

Configure the Stripe webhook to point to `/api/stripe/webhook` for both test and live environments.
