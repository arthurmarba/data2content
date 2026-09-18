---
tipo: armadilha
custo: 12 leituras de teste perdidas parecendo culpa do modelo
---

# thinkingBudget zero derruba os modelos 3

## O sintoma

Ao comparar modelos de leitura de vídeo em 18/09/2026, o `gemini-3.5-flash-lite`
falhou nas 12 leituras com "Envio interrompido ou recusado; resultado precisa de
revisão", custo zero e nenhuma resposta. Parecia modelo indisponível ou incapaz de ler
vídeo — mas a mesma conta, no mesmo minuto, lia o mesmo arquivo pela sonda direta.

## A causa

`sceneEvaluation` mandava `thinkingConfig: { thinkingBudget: 0 }`, que é o campo
numérico legado. O 2.5-flash exige isso (sem teto, o raciocínio domina a conta). Os
modelos **3.x recusam o campo** com:

```
400 INVALID_ARGUMENT — Request contains an invalid argument.
```

Sem `thinkingConfig`, ou com `thinkingConfig: { thinkingLevel: "low" }`, o mesmo
pedido volta com `finishReason: STOP` e zero tokens de raciocínio.

A mensagem do provedor não aparecia em lugar nenhum: o erro caía no ramo genérico da
governança, que grava só "resultado precisa de revisão". Ver
[[Limite de taxa virou falta de saldo e parou a fila]].

## A correção

`sceneEvaluation` escolhe pela família do modelo — `gemini-2.` usa `thinkingBudget: 0`,
o resto usa `thinkingLevel: "low"` — nos dois caminhos, vídeo e foto/carrossel.

## Onde ainda mora o mesmo risco

`analyzeInstagramPosts` (`GEMINI_INSTAGRAM_MODEL`) e `creatorScriptGenerationV3`
(`GEMINI_SCRIPT_MODEL`) continuam com `thinkingBudget: 0` fixo. Hoje as duas variáveis
apontam para `gemini-2.5-flash` e nada quebra; apontar qualquer uma para um modelo 3.x
derruba o fluxo inteiro com 400. Trocar o modelo por variável de ambiente, nesses dois
pontos, exige trocar também o campo de raciocínio.

## Ligações

[[Raciocínio do Gemini 3 come o maxTokens]] · [[Seu Mapa]]
