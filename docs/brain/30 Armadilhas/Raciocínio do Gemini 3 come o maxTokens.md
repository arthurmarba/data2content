---
tipo: armadilha
custo: resposta cortada, JSON inválido e chamada paga repetida
---

# Raciocínio do Gemini 3 come o maxTokens

## O sintoma

O enriquecimento do mapa pelo Instagram fica "adiado" para quase todo criador, e o
gasto do Gemini aparece como `llm` + `gemini-3.7-flash` com ~900 tokens de raciocínio
e só 30 a 120 de resposta. Em set/2026, 699 de 726 chamadas somavam exatamente ~1.020
tokens (raciocínio + resposta), e 45 de 51 mapas estavam travados.

## A causa

Nos modelos Gemini 3, `maxOutputTokens` inclui os tokens de raciocínio. Os call-sites do
mapa herdaram o `maxTokens` do OpenAI (1.024), que conta só o texto visível. O
raciocínio consumia o orçamento, o JSON saía cortado e `callClaudeJSON` lançava.

Como o `sourceRevision` do enriquecimento inclui a data de cada leitura de cena, toda
leitura nova reabria a tentativa — e pagava de novo.

## A correção

`geminiProvider.ts` soma `THINKING_HEADROOM_BY_LEVEL` ao teto pedido quando o modelo é
Gemini 3 e avisa no log quando `finishReason` é `MAX_TOKENS`. O enriquecimento guarda
`enrichmentStatus.failures` e dobra a espera a cada falha seguida (30 min até 24h).

## Como conferir

- `geminiusagelogs`: some `outputTokens + thoughtsTokens` por tag. Valores colados num
  teto redondo (512, 1024, 2048) são respostas cortadas.
- Procure `resposta cortada no teto` nos logs.
- `content_reading_states` com `_id` começando em `mapa:instagram:` e `state: deferred`.

## Ligações

[[Seu Mapa]] · [[Leitura de cena em loop relida a cada repescagem]] · [[Filas e rotinas]]
