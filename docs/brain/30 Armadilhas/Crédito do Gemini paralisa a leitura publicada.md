---
tipo: armadilha
custo: fila gira sem produzir inteligência nova
---

# Crédito do Gemini paralisa a leitura publicada

## O sintoma

O cron `weekly-scene-evaluation` aparece como entregue e os trabalhos chegam ao worker,
mas nenhuma evidência nova entra em `PublishedContentEvidence`. O QStash mostra várias
respostas 503 e parece que a fila ou a Vercel estão instáveis.

## A causa que já aconteceu

O Gemini devolveu HTTP 429 com `RESOURCE_EXHAUSTED` e a mensagem
`prepayment credits are depleted`. Isso não é rate limit passageiro: nenhuma tentativa
imediata funciona até o saldo do projeto ser restaurado.

`isRetryableGeminiSceneError`, em `relatorio/sceneEvaluation.ts`, separa falta de saldo
de rate limit e indisponibilidade temporária. Assim, o QStash não repete a mesma chamada
três vezes sem chance de sucesso. O cron de recuperação continua encontrando conteúdos
sem a versão atual e pode retomá-los depois que o saldo voltar.

## Como conferir

- Confirme que o agendamento foi entregue no QStash.
- Procure `prepayment credits are depleted` nos logs do worker
  `/api/worker/classify-published-scene`.
- Compare a data mais recente de `PublishedContentEvidence` com a semana atual.
- Depois de restaurar o saldo, deixe `recover-content-intelligence` reenfileirar até 40
  cenas a cada seis horas ou faça um backfill controlado.

Um post encerrado sem mídia compatível agora deixa log com tipo de mídia, presença da
URL e quantidade de imagens. Sem isso, HTTP 200 parecia sucesso embora nada fosse salvo.

## Setembro de 2026: os dois provedores sem saldo ao mesmo tempo

De 19/09 (18:21 UTC, última chamada Gemini com resposta) até a recarga, o Gemini
devolvia 402 `Your prepayment credits are depleted` e o OpenAI, reserva da
classificação de legenda, 429 `You have no credits remaining`. Nada de IA rodava.

**Como aparece.** A DLQ do QStash chegou a 18 mil mensagens em sete dias.
`classify-content [503]` com `"kind":"insufficient_quota"` é a pausa proposital: o
worker marca o post `pending` com "Classificação adiada" e devolve 503. Eram só 1.021
posts, cada um repetido ~15 vezes, porque toda sincronização do Instagram reenviava
todos os pendentes. `classify-published-scene [500]` na mesma semana não era IA: era o
Atlas recusando conexão (TLS alert 80, pool limpo, buffering) entre 00:00 e 00:03 UTC,
na enxurrada da sincronização.

**Como confirmar em um minuto.** Data da última linha de `geminiusagelogs` (só grava
chamada com resposta) e, nos logs da Vercel, `Provider gemini falhou` e
`Falha final ao processar Metric` — as duas mensagens trazem o texto cru do provedor.
O `reason` de `gemini_operations` sozinho não basta: a classificação de legenda não
passa pela governança e não deixa recibo.

**O que não fazer.** Não reenviar a DLQ: o estado verdadeiro está no Mongo e o post
adiado continua `pending`. As mensagens são cópias e expiram em cerca de sete dias.

**O custo escondido: o fechamento da semana.** Até 26/09 `loadWindow` só contava posts
com `classificationStatus: "completed"`, e a semana 2026-W38 fechou em 21/09 sem 108 de
397 posts. Desde 27/09 todo post entra pelos números e o retrato registra a cobertura;
o que a IA parada ainda tira do retrato é a leitura de cena (assunto, tom, asset), que só
roda depois da classificação. Refechar quando a leitura voltar completa isso sem trocar
os números da segunda. Para chegar na segunda com a leitura em dia, depois da recarga:

```
npm run requeue:classification-retryable -- --week=2026-W39            # simula
npm run requeue:classification-retryable -- --week=2026-W39 --write --enqueue
```

O cron `recover-content-intelligence` também drena (100 a cada seis horas, dos mais
novos para os mais antigos, só assinantes), mas pode não dar tempo. O comando por
semana não filtra assinante, então também alcança o post de quem não assina.

## Ligações

[[Filas e rotinas]] · [[Variável só no .env.local]] · [[Pautas e Roteiros]]
