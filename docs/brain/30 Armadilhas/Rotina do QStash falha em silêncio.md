---
tipo: armadilha
custo: onze meses de rotina chamando endereço inexistente sem ninguém ver
---

# Rotina do QStash falha em silêncio

## O sintoma

Nada. Esse é o problema. Uma rotina agendada com endereço errado não quebra tela,
não aparece no log da Vercel como erro da aplicação e não avisa ninguém. No painel
do QStash ela aparece como `IN_PROGRESS` — parece que está trabalhando, mas está só
repetindo uma falha.

## O caso

`whatsapp-trial` foi cadastrada à mão em 18/10/2025, quatro minutos antes de o código
subir, com destino `https://data2content.ai/app/api/cron/whatsapp-trial`. O site nunca
teve `/app` na frente dos endereços (não há `basePath`), então toda entrega caía em
`/_not-found`. Nos 16 dias que o QStash guarda: 2.295 disparos, 9.179 tentativas,
**todas 404**, cada falha final indo para a DLQ.

Não fez estrago porque o próprio recurso já estava desligado no código desde 11/2025.
A rotina foi apagada em 26/09/2026. Na mesma varredura apareceram outras três rotinas
apontando para rotas que não existem no `main` (`stripe/reconcile`,
`affiliate/cleanup-attribution`, `affiliate/sweep-stuck-redemptions`).

## Por que acontece

Publicar código não cadastra nem confere agendamento. O destino é texto livre digitado
no QStash; se a rota mudar de lugar, for apagada ou nunca chegar ao `main`, a rotina
continua disparando.

## Como conferir em dois minutos

Liste as rotinas (`GET https://qstash.upstash.io/v2/schedules`, com o `QSTASH_TOKEN`) e,
para cada destino, confira se existe `src/app<caminho>/route.ts` no `main`. Se não
existe, é rotina órfã. Para ver o histórico, `GET /v2/logs?scheduleId=<id>` e paginar
pelo `cursor`: o campo `responseStatus` (404) e o cabeçalho `X-Matched-Path`
(`/_not-found`) confirmam. Não teste chamando o endereço de uma rota que existe — algumas
rodam o trabalho de verdade.

Rotina que fala com o criador ou mexe com dinheiro se apaga ou corrige só com
confirmação do Arthur — é envio, não código.

## Ligações

[[Filas e rotinas]] · [[Trabalhos em fundo]] · [[Trabalho pronto e nunca enviado]]
