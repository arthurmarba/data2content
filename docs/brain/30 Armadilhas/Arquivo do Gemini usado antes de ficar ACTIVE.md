---
tipo: armadilha
custo: leitura de vídeo recusada pelo Gemini, lote do relatório queimado
---

# Arquivo do Gemini usado antes de ficar ACTIVE

## O sintoma

A leitura de um vídeo grande (acima do limite de envio inline) falha com HTTP 400
`FAILED_PRECONDITION`: "The File X is not in an ACTIVE state and usage is not allowed".
O envio pela Files API deu certo; quem recusa é o `generateContent`.

## A causa que já aconteceu

O `files.upload` do `@google/genai` responde antes de o vídeo terminar de processar, e às
vezes responde **sem `state` nenhum**. O código esperava o arquivo com a regra
`state !== "PROCESSING" && uri` — estado ausente passava como pronto e o arquivo cru ia
para o modelo.

O enum `FileState` do SDK é de texto: `STATE_UNSPECIFIED | PROCESSING | ACTIVE | FAILED`.
A regra certa é a positiva:

- só `ACTIVE` (com `uri`) libera o uso;
- `FAILED` é erro (`gemini_file_processing_failed`), não motivo para continuar esperando;
- estado ausente ou `STATE_UNSPECIFIED` conta como ainda processando — consulta de novo
  com `files.get`.

Aconteceu duas vezes, no mesmo formato, em dois lugares:

- `src/app/lib/relatorio/sceneEvaluation.ts` (`waitForFileReady`), corrigido em 10/09/2026;
- `src/app/dashboard/boards/videoUpload/geminiVideoNarrativeClientFactory.ts`
  (`waitForGeminiFileReady`, caminho do upload no celular), corrigido em 11/09/2026.

## Como conferir

- Qualquer código novo que suba arquivo para o Gemini: procure `!== "PROCESSING"` e troque
  por `=== "ACTIVE"`.
- Nos testes, mock de `files.upload` sem `state` precisa fazer o código consultar
  `files.get` antes de chamar o modelo — há teste disso em
  `geminiVideoNarrativeClientFactory.test.ts`.
- A Files API também reprova arquivo válido de vez em quando (`FAILED` num envio, `ACTIVE`
  no seguinte). O relatório reenvia até três vezes; o upload do celular ainda não reenvia.

## Ligações

[[Crédito do Gemini paralisa a leitura publicada]] · [[Upload de vídeo dá 403]] · [[Limite de 90 segundos]]
