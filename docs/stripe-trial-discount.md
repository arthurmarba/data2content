# Stripe: Trial + Discount simultâneo

Para garantir que o Stripe exiba o texto **"Após X dias: R$ xx com desconto"** no Checkout hospedado, a criação da assinatura deve informar **trial** e **desconto** ao mesmo tempo.

## Implementação
- `stripe.subscriptions.create` recebe `trial_period_days` e `discounts` juntos.
- `stripe.checkout.sessions.create` envia `discounts` na raiz e em `subscription_data.discounts`, além de `subscription_data.trial_period_days`.

## QA rápido
1. Definir `TRIAL_DAYS=7` e cupom de afiliado (`STRIPE_COUPON_AFFILIATE10_ONCE_BRL`).
2. Iniciar subscribe com código afiliado válido.
3. Caso o fluxo caia no Checkout hospedado, a página deve mostrar:
   > "Após 7 dias: R$ xx com desconto".

Se algum dos parâmetros estiver ausente, o Stripe oculta o texto do trial ou ignora o desconto.
