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

O estrago vem depois: o webhook (`src/server/stripe/handle-stripe-event.ts`)
descartava os avisos de uma assinatura diferente da gravada. Se a pessoa
cancelasse ou o cartão falhasse, o banco não ficava sabendo e o Pro continuava.
Desde 14/07/2026 as renovações de uma dessas pessoas também eram ignoradas.

## O caso

Em 26/09/2026, a primeira conferência banco × Stripe achou duas pessoas nessa
situação (assinaturas pagas desde 11 e 12/2025) e um terceiro caso em que o
cancelamento por falta de pagamento nunca chegou. Os três foram corrigidos no
mesmo dia.

## Por que acontece (confirmado)

1. **A assinatura fantasma.** `/api/billing/subscribe` criava a assinatura e
   procurava o código de pagamento em `invoice.payment_intent`, que não existe na
   API `2025-07-30.basil`. Sem achar, cancelava a assinatura dois segundos depois
   e mandava a pessoa para o Checkout hospedado, que criava a verdadeira. 244 das
   450 assinaturas do Stripe eram fantasmas. Os avisos da fantasma gravavam o id
   dela no banco.
2. **A fatura sem assinatura.** Até 14/07/2026, `getSubscriptionIdFromInvoice`
   só lia `invoice.subscription`, que também não existe na basil. O pagamento da
   assinatura verdadeira marcava "ativo" sem trocar o id.
3. **O banco "ativo" trancava o id.** Com o status bom, o webhook recusava a
   troca de assinatura e descartava tudo que viesse da verdadeira.

## O que foi corrigido (26/09/2026)

- A tela de assinar vai direto ao Checkout hospedado; não cria mais assinatura.
  (Consertar a leitura do código de pagamento trocaria a página do Stripe por um
  formulário embutido parado há um ano.)
- O webhook adota a assinatura do aviso quando a gravada já acabou
  (`shouldAdoptEventSubscription`): cancelamento, falha, renovação e atualização.
- Os sete `past_due` presos eram outra coisa: ver
  [[Falha de pagamento chega depois do cancelamento]].
- 13 pessoas com Pro sem assinatura que sustente ficaram como estão. A maioria é
  cortesia dada à mão (admins, `…e2e1`); duas nunca pagaram (cartão recusado,
  checkout abandonado) e viraram "ativo" minutos depois, sem caminho no código do
  Stripe. Uma aponta para outra conta Stripe (`J79YY` em vez de `JB5f3`). Não há
  registro de quem liberou cortesia — decisão do Arthur, caso a caso.

## Como conferir

```
npm run audit:stripe-subscriptions
```

Só lê e separa as divergências em sete grupos. Com `-- --corrigir`, aplica as
mesmas correções seguras da rotina diária `/api/cron/stripe-reconcile`
(`lib/billing/stripeReconciliationRun.ts`), que **nunca tiram acesso**:

- grupo 1, "paga uma assinatura que o banco não reconhece": aponta para a viva,
  com a regra da tela de assinatura — mas pula se isso tirar o Pro;
- grupo 5, quando o Stripe diz que a assinatura acabou: grava o fim como o aviso
  de cancelamento gravaria.

Os outros grupos são para olhar caso a caso: dinheiro não se corrige em lote.

## Ligações

[[Filas e rotinas]] · [[Rotina do QStash falha em silêncio]] ·
[[Falha de pagamento chega depois do cancelamento]] · [[Stripe tem dois produtos]]
