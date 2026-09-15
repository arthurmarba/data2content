---
tipo: armadilha
custo: o mesmo vídeo paga ~65 mil tokens de resposta a cada 6h
---

# Leitura de cena em loop relida a cada repescagem

## O sintoma

O custo diário do Gemini triplica sem aumento de posts. Em `geminiusagelogs`, chamadas
`cena` com `outputTokens` ≈ 65.526 (o teto do modelo) se repetem com o MESMO
`promptTokens` às 03h24, 09h24, 15h24 e 21h24 — o horário do
`recover-content-intelligence`. Em set/2026, 23 vídeos pagaram 54% de toda a saída da
leitura de cena, e nenhum deles tinha leitura salva.

## A causa

Em alguns vídeos o modelo entra em loop repetindo a transcrição. Sem `maxOutputTokens`,
vai até o teto, o JSON sai cortado e vira "Resposta ilegível". Essa mensagem não casava
com nenhuma regra de `classifyReadingFailure` e caía em `temporary_failure` (30 min), então
a repescagem relia o vídeo. Com temperatura 0, o loop se repete idêntico.

## A correção

`sceneEvaluation.ts`: teto `SCENE_MAX_OUTPUT_TOKENS`, uma única chamada e
aproveitamento de campos completos pelo `closeTruncatedObject`. Resposta ilegível
ou slides incompletos encerram a tentativa; não aguardam sete dias para pagar de novo.
A fala recuperada de resposta cortada é marcada como parcial, mesmo sem loop.

`GeminiOperation` guarda a intenção antes do envio e a resposta antes do parse.
Fila e backfill usam a mesma identidade por conteúdo. Timeout não prova custo zero;
sem resposta salva, o resultado incerto exige revisão, sem reenvio automático.
Veja [[Filas e rotinas]] para orçamento opcional e auditoria de eficiência.

## Como conferir

- Use `operationId`/`contentKey` nos logs novos. Contagem de tokens igual, sozinha,
  não prova que se trata do mesmo vídeo.
- `content_reading_states` com `reason: provider_unreadable`.

## Ligações

[[Relatório Semanal]] · [[Filas e rotinas]] · [[Raciocínio do Gemini 3 come o maxTokens]] · [[Crédito do Gemini paralisa a leitura publicada]]
