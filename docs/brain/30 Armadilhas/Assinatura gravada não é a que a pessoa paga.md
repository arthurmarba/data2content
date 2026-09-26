---
tipo: armadilha
custo: duas pessoas pagando uma assinatura que o banco não reconhecia, e sete com "pagamento atrasado" já canceladas
---

# Assinatura gravada não é a que a pessoa paga

## O sintoma

Nenhum, enquanto a pessoa continua pagando. O banco guarda em
`user.stripeSubscriptionId` uma assinatura antiga e morta (`incomplete_expired`),
mas o cliente paga outra, viva, no Stripe. O Pro aparece certo na tela, então
ninguém percebe.

O estrago vem depois: `isSubscriptionMismatch(..., { requireMatch: true })` em
`src/server/stripe/handle-stripe-event.ts` descarta os avisos de uma assinatura
diferente da gravada. Se a pessoa cancelar ou o cartão falhar, o banco não fica
sabendo e o Pro continua.

## O caso

Em 26/09/2026, a primeira conferência banco × Stripe achou duas pessoas nessa
situação: assinaturas pagas desde 11 e 12/2025, e o banco apontando para uma
tentativa de checkout anterior, que nunca foi paga e expirou. Parece checkout
que falhou e foi refeito, com a segunda assinatura nunca gravada. A causa exata ainda não foi
confirmada. As duas foram corrigidas no mesmo dia com a regra da tela de
assinatura.

A mesma conferência mostrou mais coisas que o webhook deixou passar:

- 7 pessoas como `past_due` com a assinatura já `canceled` no Stripe (jul–set/2026).
  Não dá acesso, mas o cancelamento não chegou ou foi sobrescrito.
- 13 pessoas com Pro sem assinatura que sustente. A maioria é cortesia dada à
  mão, incluindo admins e um usuário de e2e (`…e2e1`). Duas tinham assinatura
  expirada em 01/2026 e 05/2026. Uma aponta para uma assinatura de outra conta
  Stripe (`J79YY` em vez de `JB5f3`).

## Por que acontece

O webhook é o único caminho que atualiza o banco, e ele confia no id gravado.
A tela de assinatura (`/api/billing/subscription`) se corrige sozinha quando a
pessoa a abre, mas quem só usa o app nunca abre essa tela. A rotina
`stripe/reconcile`, que deveria conferir isso toda madrugada, foi cadastrada no
QStash em 08/2025 e nunca teve código (ver [[Filas e rotinas]]).

## Como conferir

```
npm run audit:stripe-subscriptions
```

Só lê e separa as divergências em sete grupos. Com `-- --corrigir`, corrige
**apenas** o grupo "paga uma assinatura que o banco não reconhece", aplicando a
mesma regra da tela de assinatura (`lib/billing/stripeSubscriptionSync.ts`). Os
outros grupos são para olhar caso a caso: dinheiro não se corrige em lote.

## Ligações

[[Filas e rotinas]] · [[Rotina do QStash falha em silêncio]]
