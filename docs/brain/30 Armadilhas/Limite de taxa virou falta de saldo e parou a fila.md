---
tipo: armadilha
custo: 807 leituras paradas por seis horas, com dinheiro na conta
---

# Limite de taxa virou falta de saldo e parou a fila

## O sintoma

`provider:gemini` aparece como `paused · provider_balance` e centenas de leituras
ficam `deferred · provider_paused`, esperando seis horas. Parece recarga vencida — e
em 18/09/2026 apareceu duas vezes no mesmo dia, logo depois de uma recarga.

## A causa

`governedGenerateContent` classificava como falta de saldo qualquer erro HTTP ≥ 400
cuja mensagem contivesse a palavra **billing** — inclusive a resposta de quota
esgotada ("Quota exceeded … check your billing plan"), que é limite de taxa e passa
sozinha. Pior: a consequência é **global** (`pauseGemini`), então um erro do modelo do
mapa (gemini-3.7-flash, em rajada de cron) parava também a leitura de cena, que roda
noutro modelo e estava saudável.

A mensagem crua do provedor não era guardada em lugar nenhum: o recibo em
`gemini_operations` só dizia `reason: "saldo"`, com `response: {}`. Sem ela não dava
para distinguir os dois casos sem ir ao provedor na mão.

## Como confirmar em dois minutos

Chamada mínima pelo mesmo SDK do app, um modelo por vez:

```
npx tsx --env-file=.env.local -e "…ai.models.generateContent({model, contents:'oi', config:{maxOutputTokens:8}})"
```

Se os modelos respondem OK, há saldo e a pausa é falsa. Vale olhar também o horário
das recusas: se elas se concentram em 00:20, 06:20, 12:20 e 18:20, é rajada de cron
batendo no limite por minuto, não dinheiro acabando.

Um `curl` direto em `v1beta` não serve de prova: ele devolve 404 para modelos que o
SDK usa normalmente.

## A correção

- Saldo agora exige mensagem explícita (crédito esgotado, pagamento requerido,
  faturamento desabilitado) **e** ausência de quota/limite de taxa na mesma mensagem.
- O recibo passa a guardar a mensagem crua do provedor (`error`).
- Teste de regressão em `geminiGovernance.test.ts`.

## Ligações

[[Crédito do Gemini paralisa a leitura publicada]] · [[Filas e rotinas]]
