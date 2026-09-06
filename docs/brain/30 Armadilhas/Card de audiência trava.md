---
tipo: armadilha
---

# "Sua Audiência" preso em Processando

## O sintoma

O card fica em "Processando" pra sempre. O Mídia Kit, na mesma conta, funciona normalmente.

## Por quê

São fontes diferentes:

| Card | Depende de |
| --- | --- |
| **Sua Audiência** | Posts **já classificados** (passam pela fila) **e** demografia da Meta |
| **Mídia Kit** | Métricas diretas — não precisa de classificação |

Ou seja: o card de audiência depende de duas coisas frágeis ao mesmo tempo. A classificação pode não ter rodado; a demografia pode simplesmente não vir da Meta.

## Onde olhar, nesta ordem

1. Os posts dessa conta estão classificados? Ver [[Classificação de conteúdo]].
2. A fila processou, ou o trabalho morreu? Ver [[Filas e rotinas]].
3. A Meta devolveu demografia? `npm run test:demographics`.
4. A conta ainda está conectada, ou o token caiu? Ver [[Instagram e métricas]].

## O que o card deveria fazer

Um estado honesto de "ainda não dá pra dizer" é melhor que um "Processando" eterno. Se você for mexer aí, mexa nisso.

## Ligações

[[Instagram e métricas]] · [[Classificação de conteúdo]] · [[Import que arrasta o servidor pro cliente]]
