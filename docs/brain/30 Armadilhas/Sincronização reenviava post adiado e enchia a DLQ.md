---
tipo: armadilha
custo: 1.021 posts viraram 15.657 mensagens na DLQ em sete dias
---

# Sincronização reenviava post adiado e enchia a DLQ

## O sintoma

A DLQ da QStash cheia de `classify-content` com HTTP 503 "Classificação adiada" —
em 26/09/2026 eram 15.657 mensagens em sete dias. Parece fila quebrada ou bug no
worker. Os picos de 1.000 a 2.100 mensagens caíam nos primeiros minutos de 00:00 UTC
e coincidiam com o Atlas M0 recusando conexão no `classify-published-scene`.

## A causa

Com Gemini (402, crédito esgotado) e OpenAI (429, sem crédito) sem saldo, o worker
faz o certo: grava o post como `pending` com "Classificação adiada" e devolve 503.
Nada se perde; o cron `recover-content-intelligence` é a retaguarda e reenvia de
6 em 6 horas.

O erro estava na outra porta. `saveMetricData`, chamado em toda sincronização do
Instagram (cron `refresh-instagram-data`, 00h e 12h UTC), mandava de novo à fila
**todo** post `pending` com legenda — sem `deduplicationId` e com as três
retentativas padrão. Cada post adiado virava quatro entregas e uma mensagem na DLQ
por sincronização, indefinidamente. Não era dado se perdendo; era eco.

## Como conferir em dois minutos

- Conte `metricId` distintos na DLQ: poucas centenas de posts com dezenas de
  repetições cada é eco, não falha nova.
- Veja o horário: pico em 00:00 e 12:00 UTC é a sincronização. O cron de recuperação
  roda a cada seis horas e respeita a janela.
- Antes de mexer em código, confira o saldo do Gemini e do OpenAI.

## A correção (26/09/2026)

- `src/app/lib/classificationRequeue.ts` guarda a regra das duas portas. Post com
  erro de saldo ou limite (`DEFERRED_CLASSIFICATION_ERROR`) é do cron. Ninguém
  reenvia antes de `INTELLIGENCE_RECOVERY_REQUEUE_HOURS` (padrão seis horas),
  medido por `classificationLastQueuedAt`.
- A sincronização continua mandando post novo na hora, agora com `deduplicationId`
  `classification-sync-<id>-<AAAA-MM-DDTHH>` (sem `:`, que a QStash recusa), duas
  retentativas, e grava `classificationLastQueuedAt` depois do envio.
- Post pendente sem erro gravado (mensagem perdida, worker que caiu antes de gravar)
  volta à fila pela sincronização depois da janela: o cron não cobre esse caso.
- O cron importa o mesmo padrão e a mesma janela. Se alguém mudar o que o cron
  recupera, a sincronização acompanha, e nenhum post fica sem porta.
- Testes: `classificationRequeue.test.ts` e `metricActions.classificationQueue.test.ts`.

## O que continua de fora

- O cron só recupera **assinantes ativos** com Instagram conectado e posts de até
  365 dias; a sincronização roda para todo Instagram conectado. Post adiado de quem
  não assina fica parado até a pessoa assinar — antes era reenviado a cada 12 horas.
  Em 26/09, 37 dos 1.016 posts adiados estavam fora do alcance do cron.
- O worker ainda responde 503 para falta de saldo. Durante uma falta de saldo, cada
  post **novo** ainda gera três entregas e uma mensagem na DLQ — uma por post, não
  uma por post a cada sincronização.
- A mesma sincronização chama `enqueuePublishedReading` para todo post concluído,
  inclusive os que a leitura de cena já encerrou como mídia não suportada (405 de
  439 em 26/09). Isso foi tratado em paralelo, no mesmo dia, pela correção da sonda
  do Gemini; se voltar a aparecer, o lugar é `enqueuePublishedReading`.
- A DLQ acumulada não foi limpa.

## Ligações

[[Filas e rotinas]] · [[Classificação de conteúdo]] · [[Crédito do Gemini paralisa a leitura publicada]] · [[Limite de taxa virou falta de saldo e parou a fila]]
