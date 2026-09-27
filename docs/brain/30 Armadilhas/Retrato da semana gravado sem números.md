---
tipo: armadilha
custo: semanas 2026-W37 e 2026-W38 congeladas praticamente sem números
---

# Retrato da semana gravado sem números

## O sintoma

O retrato do relatório por território (`WeeklyTerritoryReport`) de 2026-W37 e 2026-W38
tinha `engagementMean` zero em 10 e 12 dos 14 territórios. Os elementos estavam lá, com
ocorrências, mas sem índice: nenhum "1,4× comentários", nenhuma ordem de verdade. As
semanas anteriores (W32 a W36) tinham engajamento em todos os territórios.

## A causa

Não foi o relatório. De ~06/09 até 25/09/2026, a Meta recusava a métrica `follows` nos
Reels e a sincronização guardava o post sem alcance nem visualização (ver o fim de
[[Erro de um post pedia reconectar o Instagram]]). O fechamento de segunda leu os
números que existiam: quase nenhum. Sem alcance, as taxas saem nulas (piso de 100 de
alcance) e a mediana do território vira zero.

O histórico diário por post (`DailyMetricSnapshot`) não salva: nos mesmos dias ele
gravou zero em 323 de 326 registros da W38 anteriores ao fechamento. Não dá para
reconstruir o número da segunda por ele.

## Por que o "retrato irrecuperável" não protegeu

A regra dizia: semana fechada não se refaz, porque refazer usa os números do dia. Aqui
o número da segunda era vazio — não havia nada a proteger, e refazer com os números
atuais é ganho. Desde 27/09, o congelamento (`WeeklyStatsFreeze`) só guarda post que já
tem alcance ou visualização; post vazio espera o próximo fechamento em vez de ser
congelado vazio. Semanas fechadas antes disso refazem com `--aceitar-numeros-de-hoje`.

## Como conferir

```
db.weekly_territory_reports.aggregate([
  { $group: { _id: "$weekKey", territorios: { $sum: 1 },
    comEngajamento: { $sum: { $cond: [{ $gt: ["$engagementMean", 0] }, 1, 0] } } } },
  { $sort: { _id: -1 } }, { $limit: 6 } ])
```

Semana com muitos territórios em zero é sinal de sincronização sem números, não de
semana ruim. Nos retratos novos, `coverage.withStats` contra `coverage.posts` diz o
mesmo sem conta.

## Ligações

[[Relatório Semanal]] · [[Instagram e métricas]] · [[Crédito do Gemini paralisa a leitura publicada]]
