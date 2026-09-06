---
tipo: domínio
---

# Landing e conversão — a porta de entrada e a cobrança

## A landing viva

`src/app/page.tsx` → renderiza **`NarrativeLandingPage`** (`src/app/landing/`).

> Qualquer componente de landing **fora** de `src/app/landing/` é código morto. `LandingPageClient` e vizinhos não estão no ar.

| Peça | Caminho |
| --- | --- |
| Página | `src/app/landing/NarrativeLandingPage.tsx` |
| Texto | `src/app/landing/copy.ts`, `narrativeData.ts` |
| Estilo do arco atual | `src/app/landing/narrative-landing-v6.css` |
| Provas reais | `src/app/lib/landing/` (casting, métricas de prova, vitrine) |
| Busca | `src/seo/landing.ts` |

A landing puxa dado **de verdade** do banco (criadores, números de prova). Mudança de copy que quebra o formato do dado quebra a página.

## Duas versões da mesma seção

O arco atual tem desenho separado para celular e para computador. Ao mexer numa seção, **confira as duas** — já houve mais de um commit só de conserto porque uma delas ficou pra trás.

## Cobrança

| Peça | Caminho |
| --- | --- |
| Preços e formato | `src/app/lib/billing/pricesShape.ts`, `serverBillingPrices.ts` |
| Jornada de checkout | `checkoutJourney.ts` |
| Primeira cobrança | `firstCharge.ts` |
| CPF/CNPJ | `taxId.ts`, `syncTaxIdToStripe.ts` |
| Campanha VIP | `d2cVipCampaign.ts`, `d2cVipPromotion.ts` |
| Webhook | `/api/stripe/webhook` |
| Rotas | `/api/billing/*` (15) |

### O detalhe que quebra migração

No Stripe, o Pro **não é um produto com dois preços**: são **dois produtos separados**, o Plano Mensal e o Plano Anual. Qualquer migração de assinatura precisa rotear pelo intervalo. Ver [[Stripe tem dois produtos]].

## Afiliados

Dinheiro de verdade, com regras de segurança próprias:

| Peça | Caminho |
| --- | --- |
| Regras | `src/lib/affiliate.ts`, `src/config/affiliates.ts` |
| Amadurecimento da comissão | `src/cron/matureAffiliateCommissions.ts` + `/api/cron/mature-affiliate-commissions` |
| Atribuição | cookie `d2c_ref`, colocado pelo `src/middleware.ts` |
| Auditoria | `npm run audit:affiliate-financial-integrity` |
| Conserto | `npm run repair:affiliate-ledger`, `repair:affiliate-attributions` |

Comissão não é paga na hora: ela **amadurece** (janela de reembolso). Existem scripts de auditoria e reparo justamente porque erro aqui é erro em dinheiro — rode a auditoria antes e depois de qualquer mudança.

O manual de plantão está em `docs/affiliates-observability-runbook.md`.

## Ligações

[[Stripe tem dois produtos]] · [[MCP — ChatGPT e Claude]]
