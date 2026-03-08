# QA de Pagamentos & Afiliados (P0)

Regra vigente do programa:

- O indicado recebe `10%` de desconto apenas na primeira fatura da assinatura.
- O afiliado recebe `50%` de comissão apenas sobre a primeira fatura paga do indicado.
- Faturas recorrentes, upgrades/downgrades e reativações não geram nova comissão.

## 1) Pré-requisitos

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
NEXTAUTH_URL=http://localhost:3000
STRIPE_PRICE_MONTHLY_BRL=price_...
STRIPE_PRICE_ANNUAL_BRL=price_...
STRIPE_COUPON_AFFILIATE10_ONCE_BRL=coupon_...
INTERNAL_CRON_SECRET=algum-segredo
```

Stripe CLI:

```bash
brew install stripe/stripe-cli/stripe
stripe login
```

## 2) Scripts de QA

Localizados em `qa/`:

- `stripe-listen.sh`
- `stripe-triggers.sh`
- `http.sh`

Opcionalmente adicionados em `package.json`:

```json
{
  "scripts": {
    "qa:listen": "bash qa/stripe-listen.sh",
    "qa:triggers": "bash qa/stripe-triggers.sh",
    "qa:http": "bash qa/http.sh"
  }
}
```

## 3) Preparação de dados (dev)

Afiliado de teste com `affiliateCode` conhecido (ex.: `D2C123`).

Comprador de teste sem assinatura ativa.

Garantir que o comprador não use seu próprio código (auto-referência bloqueia).

Exemplos em Mongo:

```javascript
// defina um afiliado com code D2C123
db.users.updateOne({ email: "afiliado@teste.com" }, { $set: { affiliateCode: "D2C123" } })
// confirme comprador
db.users.findOne({ email: "comprador@teste.com" }, { affiliateUsed:1, planStatus:1, stripeSubscriptionId:1 })
```

## 4) Cenários de teste (passo a passo)

### C1 — Compra com 3DS (happy path)
1. Abrir pricing → selecionar Mensal BRL.
2. Digitar código afiliado válido (ex.: D2C123).
3. Pagar com 3DS `4000 0025 0000 3155`.

**Esperado:**
- Redireciona para `/dashboard/billing/success` → polling confirma “Ativo”.
- Checkout/preview mostra `10%` de desconto só na primeira cobrança.
- Mongo (comprador): `planStatus="active"`, `planInterval="month"`, `planExpiresAt` setado, `stripeSubscriptionId` setado, `affiliateUsed="D2C123"`.
- Mongo (afiliado): `commissionLog[0] = { type:"commission", status:"pending", amountCents=50% do valor pago na primeira fatura, commissionRateBps:5000, availableAt ~ +7d }`.
- Exemplo: se a mensalidade é `R$ 100,00`, o indicado paga `R$ 90,00` e a comissão esperada é `R$ 45,00`.
- Idempotência: reprocessar webhook/evento não duplica comissão.

### C2 — Código inválido → 422
1. Digitar código aleatório `XYZ123`.

**Esperado:** backend retorna `422` e a UI exibe “Código inválido ou expirado.”

### C3 — Cupom válido manual (promotion code)
1. Criar um Promotion code no Stripe (modo teste).
2. Digitar no campo.

**Esperado:** desconto aplicado na fatura; segue para pagamento; sem comissão de afiliado.

### C3.1 — Cupom de afiliado mal configurado no Stripe
1. Temporariamente apontar `STRIPE_COUPON_AFFILIATE10_ONCE_BRL` para um cupom que não seja `10%` ou não seja `once`.
2. Abrir preview ou tentar checkout com código de afiliado válido.

**Esperado:** backend bloqueia a operação com erro de configuração do cupom de afiliado.

### C4 — Falha e retry
1. Iniciar assinatura normalmente.
2. Usar cartão que falha `4000 0000 0000 9995`.
3. Tentar novamente com 3DS `3155`.

**Esperado:**
- Erro amigável no formulário e possibilidade de tentar novamente.
- `lastPaymentError` preenchido na falha; limpo na cobrança sucedida.

### C5 — Upgrade/Downgrade (sem nova comissão)
1. Com assinatura ativa, iniciar subscribe para Anual BRL.
2. Backend faz update (proration).

**Esperado:**
- `customer.subscription.updated` sincroniza `stripePriceId`, `planInterval="year"`.
- Não cria nova comissão.
- `commissionLog` do afiliado continua com apenas a primeira comissão da assinatura original.

### C6 — Cancelar ao fim do período / Reativar
1. `POST /api/billing/cancel` (UI ou `qa/http.sh`).
2. `POST /api/billing/reactivate`.

**Esperado:** status UI alterna entre “Cancelado ao fim do período” e “Ativo”.

### C7 — Refund parcial (ajuste de comissão)
1. Via Dashboard Stripe, faça refund parcial da última cobrança (ex.: 50%).

**Esperado:** `processAffiliateRefund` cria ajuste no `commissionLog` e debita saldo proporcional usando a taxa persistida no lançamento original (`commissionRateBps`).

### C8 — Invoice voided (cancelado antes de pagar)
1. `stripe trigger invoice.voided`.

**Esperado:** entrada de comissão vira `reversed` com motivo `invoice_voided`; saldo reduzido se necessário.

### C9 — subscription.deleted (encerramento)
1. `stripe trigger customer.subscription.deleted`.

**Esperado:** comprador `planStatus="inactive"`, `planExpiresAt=null`.

### C10 — Maturação (hold → available)
1. Ajustar manualmente `availableAt` para ontem.
2. Chamar `POST /api/internal/affiliate/mature`.

**Esperado:** resposta indica promoção de entradas pendentes; `commissionLog.status` muda de `pending` para `available`, `maturedAt` é preenchido e o saldo do afiliado incrementa.

### C11 — Segunda cobrança da mesma assinatura
1. Após a primeira cobrança aprovada, simular ou aguardar uma segunda invoice paga da mesma assinatura.
2. Reprocessar os webhooks necessários.

**Esperado:** não surge nova comissão para o afiliado, porque a assinatura já consumiu a comissão da primeira fatura.

### C12 — Autoindicação bloqueada
1. Logar como o próprio afiliado.
2. Tentar usar o próprio código/link no checkout.

**Esperado:** backend retorna bloqueio de autoindicação; nenhuma assinatura/comissão de afiliado é criada com esse vínculo.

## 5) Consultas Mongo úteis

```javascript
// Comprador (ver status e vínculo de afiliação)
db.users.findOne(
  { email: "comprador@teste.com" },
  { planStatus:1, planInterval:1, planExpiresAt:1, stripeSubscriptionId:1, affiliateUsed:1, lastPaymentError:1 }
)

// Afiliado (ver últimas comissões e saldo)
db.users.findOne(
  { email: "afiliado@teste.com" },
  { affiliateBalances:1, affiliateDebtByCurrency:1, commissionLog: { $slice: -5 } }
)

// Conferir campos importantes da comissão
db.users.findOne(
  { email: "afiliado@teste.com" },
  {
    commissionLog: {
      $slice: -5
    }
  }
)

// Índices de idempotência
db.affiliateinvoiceindexes.find().sort({ createdAt:-1 }).limit(5)
db.affiliatesubscriptionindexes.find().sort({ createdAt:-1 }).limit(5)
db.affiliaterefundprogresses.find().sort({ createdAt:-1 }).limit(5)
```

## 6) Critérios de Aceite

- 3DS conclui e `/dashboard/billing/success` confirma via polling.
- Código válido de afiliado aplica `10%` de desconto apenas na primeira cobrança.
- A primeira fatura paga gera exatamente uma comissão de `50%` do valor efetivamente pago.
- Idempotência: 1ª fatura paga cria uma comissão; triggers repetidos não duplicam.
- Falha e retry funcionam; `lastPaymentError` popula/limpa corretamente.
- Upgrade/downgrade sem nova comissão; `updated` sincroniza plano.
- Cancel/reactivate/portal OK; UI reflete estados.
- Refund parcial/total ajusta comissão/saldo/dívida corretamente.
- Invoice voided reverte comissão pendente/available.
- `subscription.deleted` deixa plano `inactive`.
- Maturação move `pending → available` e credita saldo.
- Segunda cobrança da mesma assinatura não gera nova comissão.

## 7) Troubleshooting

- Webhook não dispara: confira `stripe listen` e `STRIPE_WEBHOOK_SECRET`.
- Payment Element não volta para success: verifique `return_url`.
- Cupom de afiliado ausente: definir `STRIPE_COUPON_AFFILIATE10_ONCE_BRL`.
- Cupom de afiliado inválido: garantir que o cupom do Stripe seja `10%` e `duration=once`.
- Duplicidade de comissão: checar coleções `AffiliateInvoiceIndex` e `AffiliateSubscriptionIndex`.
- Refund parcial não refletiu: confira se foi na charge correta e aguarde webhook.
