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

## Ligações

[[Filas e rotinas]] · [[Variável só no .env.local]] · [[Pautas e Roteiros]]
