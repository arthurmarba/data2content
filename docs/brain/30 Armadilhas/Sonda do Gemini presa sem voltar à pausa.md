---
tipo: armadilha
custo: posts e mapas encerrados para revisão manual enquanto o Gemini estava sem crédito
---

# Sonda do Gemini presa sem voltar à pausa

## O sintoma

`content_reading_states`, documento `provider:gemini`: `state: "probing"`,
`reason: "provider_balance"`, `nextAttemptAt` no passado e `leaseUntil` renovado a
cada ~6 minutos. A fila continua recebendo leituras mesmo sem crédito. Ao mesmo tempo
crescem estados `unsupported · provider_review_required` com
`gemini_result_unknown: Envio interrompido ou recusado`, e `gemini_operations` acumula
registros `mapa_instagram` parados em `started`.

Visto em 26/09/2026: o crédito tinha acabado em 19/09; 46 mapas e 9 posts foram
encerrados para revisão só naquele período, e 243 registros do mapa ficaram parados.

## A causa

O Gemini sem crédito responde **HTTP 402** com a mensagem "prepayment credits are
depleted" e o status **`RESOURCE_EXHAUSTED`** no corpo. A correção de
[[Limite de taxa virou falta de saldo e parou a fila]] tinha passado a descartar como
falta de saldo qualquer mensagem com `resource_exhausted`. O 402 também não é 429/503,
então `governedGenerateContent` o tratava como envio interrompido:

1. o erro virava `gemini_result_unknown`, não `gemini_provider_balance`;
2. `classifyReadingFailure` encerrava o item como `provider_review_required`, sem
   `pauseGemini`;
3. a sonda ficava em `probing`; seis minutos depois a posse vencia e o próximo job era
   a nova sonda — que encerrava mais um item.

Somava-se a isso: o worker tomava a sonda **antes** de buscar a mídia. Um post sem mídia
compatível ficava com ela seis minutos sem perguntar nada ao provedor, e os outros jobs
voltavam adiados seis horas.

## A correção

- `isGeminiBalanceError` (`llm/geminiGovernance.ts`): 402 é sempre falta de saldo; o
  texto explícito do crédito também, com qualquer status. Só "billing" solto exige
  ausência de cota — é o que distingue a mensagem de 18/09/2026.
- `classifyReadingFailure` reconhece `gemini_provider_balance` pelo nome.
- O worker checa `geminiUnavailable()` (só leitura) antes de baixar mídia e toma a sonda
  com `claimGeminiAvailability()` logo antes de chamar o Gemini.
- `enqueuePublishedReading` usa `geminiUnavailable()`: bloqueia pausa com prazo futuro e
  sonda com posse ativa.

Com isso a sonda que encontra o 402 grava `paused` com nova espera de seis horas, e o
post volta para `deferred · provider_balance`, não para revisão manual.

## Depois da recarga: presa em "testando" com o Gemini respondendo

Em 27/09/2026, com o crédito já recarregado (22:32 UTC), duas leituras concluíram à 00:01
e marcaram o provedor como saudável. Às 00:20, na rajada do cron de recuperação, um job
tinha lido "testando" um instante antes; o `findOneAndUpdate` de `claimGeminiAvailability`
não exigia estado não saudável e reabriu a sonda por cima. Resultado: `probing` com
`nextAttemptAt` zerado e `reason: null` (a assinatura do `markGeminiHealthy`). Nas seis
horas seguintes, 707 leituras voltaram adiadas por "pausa", com o Gemini respondendo
normalmente pelo lote.

Correção: o filtro exige `state != healthy`; se não pegar a sonda, o job relê e segue
liberado quando outro já confirmou a recuperação.

Na mesma janela, 32 envios (8 posts, 24 mapas) caíram em "Envio interrompido ou recusado"
sem registro da causa. Agora esse caminho guarda status e mensagem crua em
`gemini_operations.error` (a operação continua `started`, sem reenvio) e no log.

## A outra metade: posts encerrados republicados

`enqueuePublishedReading` só pulava posts com evidência. Posts encerrados
(`unsupported`: mídia incompatível, ilegível, revisão manual) não têm evidência e eram
publicados a cada sincronização do Instagram (00h e 12h UTC). Na DLQ de 26/09/2026, 405
dos 439 itens de `classify-published-scene` já estavam `unsupported_media`. Agora a fila
usa `eligibleReadingIds` com a revisão do formato do post: não publica quem está
encerrado, adiado ou com posse ativa. O encerramento vale só para aquela revisão.

## Como conferir

- `provider:gemini` em `probing` com `nextAttemptAt` antigo: olhe `lastError` dos estados
  recentes e `gemini_operations` em `started`. Se aparecer 402 ou "depleted", é saldo.
- `probing` com `nextAttemptAt` em 1970 e `reason: null`: alguém já tinha confirmado a
  recuperação e a sonda foi reaberta por cima — é a corrida, não falta de saldo.
- A última linha de `geminiusagelogs` mostra quando o Gemini respondeu pela última vez.
- Os itens encerrados antes da correção não voltam sozinhos: seguem precisando de revisão
  (não apagar operações para liberar fila — ver [[Filas e rotinas]]).

## Ligações

[[Crédito do Gemini paralisa a leitura publicada]] · [[Limite de taxa virou falta de saldo e parou a fila]] · [[Filas e rotinas]] · [[Leitura de cena em loop relida a cada repescagem]]
