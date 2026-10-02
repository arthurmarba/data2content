---
tipo: armadilha
---

# Retenção gravada como zero

## O sintoma

Um criador pediu ao Claude a retenção dos Reels e recebeu "0 de 103 posts com
retenção", com o tempo médio assistido presente em todos. Olhando a base inteira
(02/10/2026): **33.559 vídeos com retenção 0 e nenhum com valor positivo**. A
retenção nunca tinha funcionado para ninguém.

O pior não era o vazio do criador novo — era o zero dos antigos. Zero parece dado:
"ninguém assiste". O `contentIntelligence` do MCP preferia o campo gravado à conta
feita na hora, então lia 0% para a base toda.

## Por que acontecia

A retenção é tempo médio ÷ duração, e as duas metades chegam por caminhos
diferentes: o tempo vem dos insights (em milissegundos), a duração vem da mídia.
A conta rodava em `calcFormulas`, que recebe **só os insights brutos** — sem
duração e procurando um campo (`average_video_watch_time_seconds`) que a API nunca
manda. Antes de 26/09/2026 o `safeRatio` devolvia 0 na falta de denominador; depois,
`null`. Nos dois casos, nenhuma retenção de verdade jamais foi gravada.

## Como ficou

- A conta mora em `saveMetricData`, depois de a duração ser resolvida, via
  `retentionRateFromWatchTime` (`src/app/lib/formulas.ts`).
- `scripts/recalcularRetencao.ts` recalculou a base: 19.270 vídeos com valor real;
  15.892 vídeos sem uma das metades e 1.634 fotos trocaram o zero por `null`.
- Valor acima de 1 é legítimo (gente revendo o vídeo): ~600 vídeos na base.

## A regra que fica

Antes de gravar uma taxa, confira se o numerador e o denominador **existem no mesmo
lugar e na mesma unidade** no momento da conta. Taxa calculada cedo demais não dá
erro — dá zero, e zero passa por dado.

Ligações: [[Instagram e métricas]] · [[Cobertura que cobra o impossível]]
