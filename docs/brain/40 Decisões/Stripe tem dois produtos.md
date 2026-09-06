---
tipo: decisão
área: cobrança
---

# No Stripe, o Pro são dois produtos, não um com dois preços

## O fato

- **Plano Mensal** — um produto
- **Plano Anual** — outro produto

Não é um produto com dois preços. Toda migração de assinatura precisa **rotear pelo intervalo**, ou o criador vai parar no produto errado.

## Reajuste de 2026

| | Novos | Legado |
| --- | --- | --- |
| Mensal | R$ 97 | R$ 79,90 |
| Anual | R$ 890 | R$ 690 |

Quem já era assinante mantém o preço antigo. Qualquer cálculo de preço precisa saber de qual lado o criador está.

## Onde vive

`src/app/lib/billing/pricesShape.ts`, `serverBillingPrices.ts`, variáveis `STRIPE_PRICE_MONTHLY_BRL` / `STRIPE_PRICE_ANNUAL_BRL` (e os pares em USD). Plano escrito: `docs/pricing-migration-2026.md`.

## Ligações

[[Landing e conversão]]
