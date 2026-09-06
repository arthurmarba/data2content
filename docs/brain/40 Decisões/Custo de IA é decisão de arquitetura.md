---
tipo: decisão
área: IA
---

# O custo de IA é escolha de arquitetura, não detalhe de configuração

## A postura

A migração OpenAI → Gemini foi feita **em fases, híbrida, com queda pro outro provedor** — nunca "troca tudo de uma vez". O núcleo (`src/app/lib/llm/`) não sabe de quem é o modelo; quem decide é a variável de ambiente por escopo.

Escopos que já nascem no Gemini por serem mais baratos: `MAPA`, `SCRIPTS`, `COMMUNITY`, `CLASSIFICATION`. O resto segue no OpenAI.

## O que já foi feito pra cortar custo

- Modelo menor onde a tarefa aguenta
- Mapa indo primeiro no Gemini
- Sem esquema rígido em conversa livre
- Subconjunto de ferramentas por intenção, ligado por variável
- Cache na classificação
- "Pensamento" desligado nas ferramentas do celular

## A regra prática

Antes de trocar modelo ou prompt: **meça**. Existem `geminiUsageLog.ts` e `geminiShadowCompare.ts` justamente pra comparar sem apostar. Para roteiros, `npm run check:scripts-quality` roda os testes **e** o benchmark.

Trocar prompt sem benchmark é chute com custo mensal.

## Ligações

[[10 Mapa do sistema]] · [[Pautas e Roteiros]] · [[Classificação de conteúdo]]
