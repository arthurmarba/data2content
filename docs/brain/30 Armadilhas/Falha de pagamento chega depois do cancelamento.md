---
tipo: armadilha
custo: todo cancelamento por falta de pagamento entre 25/07 e 25/09/2026 ficou como "pagamento atrasado" (6 de 6)
---

# Falha de pagamento chega depois do cancelamento

## O sintoma

A pessoa foi cancelada por falta de pagamento no Stripe, mas o banco mostra
`past_due`. Não libera o Pro, mas o app manda "Atualizar pagamento" de uma
assinatura que não existe mais e bloqueia a leitura grátis: quem quer voltar a
assinar fica sem caminho.

## Por que acontece

Quando o Stripe desiste de cobrar, ele manda dois avisos com dois segundos de
diferença: `invoice.payment_failed` (a última tentativa) e
`customer.subscription.deleted`. O Stripe não garante a ordem de entrega. O
aviso de falha gravava `past_due` sem olhar a assinatura; se chegasse por último,
sobrescrevia o cancelamento.

Até 21/07/2026 isso era raro porque `shouldIgnoreOutOfOrderEvent` descartava
avisos mais antigos que o último processado. O commit `b953dded` tornou essa
trava só diagnóstica (ela podia descartar evento financeiro legítimo). A partir
do dia 25/07, os seis cancelamentos por inadimplência ficaram `past_due`.

## A correção (26/09/2026)

O aviso de falha relê a assinatura antes de gravar
(`resolvePaymentFailedStatus`): se ela já acabou, o status fica como está (quem
grava o fim é o aviso de cancelamento); se ainda está ativa, também não mexe
(outra tentativa passou). Só grava atraso quando o Stripe diz que está em atraso.
Os sete presos foram corrigidos com `npm run audit:stripe-subscriptions --
--corrigir`; a rotina diária `/api/cron/stripe-reconcile` pega os próximos.

## A regra

Aviso do Stripe que muda status tem que reler a assinatura. Não confie na ordem
de chegada nem religue uma trava de ordem para compensar.

## Ligações

[[Assinatura gravada não é a que a pessoa paga]] · [[Filas e rotinas]]
