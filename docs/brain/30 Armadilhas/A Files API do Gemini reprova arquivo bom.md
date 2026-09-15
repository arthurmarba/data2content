---
tipo: armadilha
custo: um terço do lote de leitura de cena perdido sem motivo real
---

# A Files API do Gemini reprova arquivo bom

## O sintoma

No backfill de cenas (`npm run relatorio:cenas`) e no worker
`/api/worker/classify-published-scene`, vídeos acima de 14 MB — os que vão pela Files
API em vez de ir embutidos na requisição — falhavam com uma destas duas mensagens:

- `The File <id> is not in an ACTIVE state and usage is not allowed.` (HTTP 400,
  FAILED_PRECONDITION)
- `gemini_file_processing_failed` (código 13, "The file failed to be processed")

Em 10/09/2026, sete de cada quatorze vídeos do lote caíram assim.

## As duas causas

**A espera terminava cedo.** `waitForFileReady` devolvia o arquivo assim que o estado
fosse diferente de `PROCESSING`. Só que o `files.upload` responde antes de o vídeo
terminar de processar e às vezes **sem estado nenhum** — e `undefined !== "PROCESSING"`
é verdadeiro. O arquivo cru seguia para o `generateContent`, que recusava. Agora só
`ACTIVE` serve; estado ausente conta como ainda processando.

**A Files API erra sozinha.** Depois de corrigida a espera, sobrou o código 13. O mesmo
mp4, subido duas vezes seguidas, deu `FAILED` na primeira e `ACTIVE` na segunda —
arquivo íntegro (`ftypisom`, 21,6 MB, 90 s), servido pela Graph API. Não é o vídeo, não
é o nosso envio: é intermitência do lado do Google. `uploadVideo` passou a tentar duas
vezes, apagando o arquivo reprovado entre uma e outra.

## Como conferir

- Um `FAILED` isolado não prova nada sobre o vídeo. Suba o mesmo arquivo de novo antes
  de culpar o codec, o tamanho ou a Graph API.
- `gemini_file_processing_failed` cai em `temporary_failure` no
  `classifyReadingFailure`, então a fila de produção tenta de novo em 30 minutos. No
  script local não há retaguarda: reexecutar o comando é o que recupera.
- Vídeo acima de 180 s é recusa legítima (`MAX_VIDEO_SECONDS`), não intermitência.

## O mesmo descuido mora em outro lugar

`waitForGeminiFileReady`, em
`src/app/dashboard/boards/videoUpload/geminiVideoNarrativeClientFactory.ts`, tem a
mesma condição `state !== "PROCESSING"` — no teste inicial e dentro do laço. O upload
pelo botão + está exposto ao mesmo 400.

## Ligações

[[Crédito do Gemini paralisa a leitura publicada]] · [[Retry da análise reutiliza vídeo apagado]] · [[Relatório Semanal]]
